define(
    [
        'require',
        'plugins/domready',
        'moddef',
        'hammer',
        'physicsjs',
        'modules/multicanvas-renderer'
    ],
    function(
        require,
        domReady,
        M,
        hammer,
        Physics,
        _mcr
    ) {

        'use strict';

        function logerr( err ){
            window.console.error( err );
        }

        // VERY crude approximation to a gaussian random number.. but fast
        var gauss = function gauss( mean, stddev ){
            var r = 2 * (Math.random() + Math.random() + Math.random()) - 3;
            return r * stddev + mean;
        };

        function sign( n ){
            return n >= 0 ? 1 : -1;
        }

        function pad(num, size) {
            var s = '000000000' + num;
            return s.substr(s.length - size);
        }

        function toggleClass( el, cls ){
            var classes = el.className.split(' ')
                ,idx = classes.indexOf( cls )
                ;

            if ( idx > -1 ){
                classes.splice( idx, 1 );
                el.className = classes.join(' ');
                return false;
            } else {
                el.className += ' ' + cls;
                return true;
            }
        }

        /**
         * Page-level Mediator
         * @module Boilerplate
         * @implements {Stapes}
         */
        var Mediator = M({

            /**
             * Mediator Constructor
             * @return {void}
             */
            constructor : function(){

                var self = this;

                self.scale = 0.25;
                self.minScale = 0.05;
                self.maxScale = 1;

                self.initEvents();

                domReady(function(){
                    self.onDomReady();
                    self.resolve('domready');
                });
            },

            /**
             * Initialize events
             * @return {void}
             */
            initEvents : function(){

                var self = this;

                function scaleEvent(){
                    self.scale = Math.max(self.minScale, Math.min(self.maxScale, self.scale));
                    self.emit('scale', self.scale);
                }

                self.after('domready', function(){

                    var lastScale
                        ,sim = document.getElementById('sim')
                        ;

                    sim.focus();
                    
                    var hammertime = hammer( sim );
                    hammertime.on('mousewheel', function( e ) { 
                        var zoom = Math.min(Math.abs(e.wheelDelta) / 50, 0.2) * sign(e.wheelDelta);
                        self.scale *= Math.pow(2, zoom);
                        scaleEvent();
                        e.preventDefault();
                    });

                    hammertime.on('transformstart', function( e ){
                        lastScale = self.scale;
                        e.preventDefault();
                    });

                    hammertime.on('transform', function( e ){
                        self.scale = lastScale * e.gesture.scale;
                        scaleEvent();
                        e.preventDefault();
                    });

                    hammertime.on('touch', function( e ){
                        e.preventDefault();
                        self.emit('touch', e);
                    });

                    hammertime.on('touchstart', function( e ){
                        sim.focus();
                        e.preventDefault();
                    });

                    hammertime.on('drag', function( e ){
                        e.preventDefault();
                        self.emit('drag', e);
                    });

                    hammertime.on('release', function( e ){
                        e.preventDefault();
                        self.emit('release', e);
                    });

                    // control panel
                    var controls = hammer( document.getElementById('controls') );
                    controls.on('touch', function( e ){
                        if ( e.target.id === 'ctrl-brakes' ){
                            self.emit('brakes');
                        } else if ( e.target.id === 'ctrl-grab-mode' ){
                            self.grabMode = toggleClass(e.target, 'on');
                        } else if ( e.target.id === 'ctrl-zoom-in'){
                            self.scale *= 2;
                            scaleEvent();
                        } else if ( e.target.id === 'ctrl-zoom-out'){
                            self.scale *= 0.5;
                            scaleEvent();
                        }
                    });

                    var keys = {
                        up: 0
                        ,down: 0
                        ,left: 0
                        ,right: 0
                    };

                    function thrustEvent(){
                        var acc = { x: 0, y: 0 };
                        acc.x = keys.right - keys.left;
                        acc.y = keys.down - keys.up;
                        self.emit('thrust', acc);
                    }

                    sim.addEventListener('keydown', function( e ){
                        switch ( e.keyCode ){
                            case 38: // up
                            case 87: // w
                                keys.up = 1;
                                thrustEvent();
                            break;
                            case 40: // down
                            case 83: // s
                                keys.down = 1;
                                thrustEvent();
                            break;
                            case 37: // left
                            case 65: // a
                                keys.left = 1;
                                thrustEvent();
                            break;
                            case 39: // right
                            case 68: // d
                                keys.right = 1;
                                thrustEvent();
                            break;
                        }

                        return false;
                    });

                    sim.addEventListener('keyup', function( e ){
                        switch ( e.keyCode ){
                            case 38: // up
                            case 87: // w
                                keys.up = 0;
                                thrustEvent();
                            break;
                            case 40: // down
                            case 83: // s
                                keys.down = 0;
                                thrustEvent();
                            break;
                            case 37: // left
                            case 65: // a
                                keys.left = 0;
                                thrustEvent();
                            break;
                            case 39: // right
                            case 68: // d
                                keys.right = 0;
                                thrustEvent();
                            break;
                        }

                        return false;
                    });
                });
            },

            initPhysics: function( world ){

                var self = this
                    ,i
                    ,l
                    ,viewWidth = window.innerWidth
                    ,viewHeight = window.innerHeight
                    ,sightRadius = Math.max( viewWidth, viewHeight ) * 0.5 * ( Math.sqrt(2) )
                    ,renderer = Physics.renderer('multicanvas', {
                        el: 'physics',
                        width: viewWidth,
                        height: viewHeight,
                        // meta: true,
                        // debug:true,
                        styles: {
                            'circle': {
                                strokeStyle: '#1a1a1a',
                                lineWidth: 0,
                                fillStyle: '#1a1a1a',
                                angleIndicator: 'rgba(0,0,0,0)'
                            }
                        }
                    })
                    // bounds of the window
                    ,viewportBounds = Physics.aabb(0, 0, viewWidth, viewHeight)
                    ;

                this.world = world;
                this.renderer = renderer;
                
                // add the renderer
                world.add(renderer);

                // render on each step
                world.on('step', function () {
                    world.render();
                });
                
                // resize events
                window.addEventListener('resize', function () {
            
                    viewWidth = window.innerWidth;
                    viewHeight = window.innerHeight;
            
                    renderer.resize( viewWidth, viewHeight );
                    sightRadius = Math.max( viewWidth, viewHeight ) * 0.5;
            
                    viewportBounds = Physics.aabb(0, 0, viewWidth, viewHeight);
            
                }, true);
                
                // subscribe to ticker to advance the simulation
                Physics.util.ticker.on(function (time, dt) {
            
                    world.step(time);
                });
            
                // start the ticker
                Physics.util.ticker.start();

                var sheep = [];

                for ( i = 0, l = 5; i < l; ++i ){
                    
                    sheep.push(Physics.body('circle', {
                        x: Math.random() * viewWidth
                        ,y: Math.random() * viewHeight
                        ,vx: Math.random() * 0.1
                        ,vy: Math.random() * 0.1
                        ,radius: 12
                        ,classed: 'sheep'
                        ,styles: {
                            src: require.toUrl( '../../images/Sheep.png' )
                        }
                    }));
                }

                world.add([
                    Physics.behavior('body-collision-detection').applyTo( sheep ),
                    Physics.behavior('sweep-prune'),
                    Physics.behavior('body-impulse-response')
                ]);

                var spaceCamBody = Physics.body('point', {
                    x: viewWidth * 0.5
                    ,y: viewHeight * 0.5
                    ,treatment: 'kinematic'
                });

                var parallaxBody = Physics.body('point', {
                    x: viewWidth * 0.5
                    ,y: viewHeight * 0.5
                    ,treatment: 'kinematic'
                });

                world.add([
                    spaceCamBody 
                    ,parallaxBody
                ]);

                // rocket
                var rocket = self.addRocket(viewWidth * 0.5, viewHeight * 0.5);

                renderer.layers.main
                    .addToStack( sheep )
                    // .addToStack( rocket.gravometer )
                    .options({ 
                        follow: spaceCamBody
                        ,scale: self.scale
                        ,offset: Physics.vector(viewWidth * 0.5, viewHeight * 0.5) 
                    })
                    ;

                // rocket rendering
                var rocketLayer = renderer.addLayer('rocket', null, {
                    follow: spaceCamBody
                    ,scale: self.scale
                    ,offset: Physics.vector(viewWidth * 0.5, viewHeight * 0.5)
                });
                rocketLayer.render = function(){

                    var ctx = rocketLayer.ctx
                        ,aabb = rocket.aabb
                        ,scratch = Physics.scratchpad()
                        ,offset = scratch.vector().set(0, 0)
                        ,scale = rocketLayer.options.scale
                        ;

                    if ( rocketLayer.options.offset ){
                        offset.vadd( rocketLayer.options.offset ).mult( 1/scale );
                    }

                    if ( rocketLayer.options.follow ){
                        offset.vsub( rocketLayer.options.follow.state.pos );
                    }

                    ctx.clearRect(0, 0, rocketLayer.el.width, rocketLayer.el.height);
                    ctx.save();
                    ctx.scale( scale, scale );
                    rocket.drawTo(aabb._pos.get(0) + offset.get(0), aabb._pos.get(1) + offset.get(1), ctx, renderer);
                    ctx.restore();
                    scratch.done();
                };

                var drag = false
                    ,orig = Physics.vector()
                    ,movePos = Physics.vector()
                    ,thrustAcc = Physics.vector()
                    ,throttleTime = 1000 / 60 | 0
                    ;

                self.on('touch', function( ev, e ){
                    var pos = e.gesture.center;
                    pos.x = pos.pageX;
                    pos.y = pos.pageY;
                    orig.clone( pos ).sub( viewWidth/2, viewHeight/2 ).mult( 1 / self.scale ).vadd( spaceCamBody.state.pos );

                    if ( rocket.outerAABB.contains( orig ) ){

                        drag = true;
                        orig.clone( rocket.pos );
                        movePos.clone( orig );

                    } else {
                        // rocket.thrust = true;
                    }
                });

                self.on('thrust', function( e, acc ){
                    
                    rocket.thrust = true;
                    thrustAcc.clone( acc ).normalize();
                    rocket.thrust = !thrustAcc.equals( Physics.vector.zero );
                });

                self.on('drag', Physics.util.throttle(function(ev, e){
                    var pos = e.gesture.center;
                    pos.x = pos.pageX;
                    pos.y = pos.pageY;
                    
                    if ( drag ){

                        movePos
                            .clone( orig )
                            .add( e.gesture.deltaX / self.scale, e.gesture.deltaY / self.scale )
                            ;
                    }

                }, throttleTime));

                self.on('release', function( ev, e){
                    drag = false;
                    rocket.thrust = false;
                });

                self.on('scale', function( ev, scale ){
                    renderer.layers.main.options({ scale: scale });
                    rocketLayer.options({ scale: scale });
                });

                self.on('brakes', function(){
                    rocket.edge.body.state.vel.zero();
                });

                world.on('integrate:positions', function( data ){

                    rocket.moveTo( rocket.pos );
                    
                    if ( rocket.thrust ){
                        rocket.edge.body.state.acc.clone( thrustAcc ).mult( 0.0001 );
                    } else if ( drag ) {

                        if ( self.grabMode ){
                            rocket.edge.body.state.vel.clone( movePos ).vsub( rocket.pos ).mult( 1/throttleTime ).vadd( spaceCamBody.state.vel );
                            movePos.vadd( spaceCamBody.state.vel.mult( data.dt ) );
                            orig.vsub( spaceCamBody.state.vel );
                            spaceCamBody.state.vel.mult( 1/data.dt );
                        } else {
                            rocket.edge.body.state.acc.clone( movePos ).vsub( rocket.edge.body.state.pos ).normalize().mult( 0.001 );
                        }
                    }
                });

                // explicitly add the edge behavior body to the world
                rocket.edge.body.treatment = 'kinematic';
                world.add([ 
                    rocket.edge.body
                    // ,rocket.gravometer
                    ,rocket.constr
                ]);

                rocket.edge.applyTo( sheep );
                world.add( sheep );
                world.add( rocket.edge );


                var rocketCam = renderer.addLayer('rocket-cam', null, {
                    width: 400
                    ,height: 400
                    ,autoResize: false
                    ,follow: rocket.edge.body
                    ,offset: Physics.vector(200, 160)
                });

                var oldRender = rocketCam.render;
                rocketCam.render = function(){

                    var ctx = rocketCam.ctx
                        ,aabb = rocket.aabb
                        ,offset = rocketCam.options.offset
                        ;

                    ctx.clearRect(0, 0, rocketCam.el.width, rocketCam.el.height);
                    rocket.drawTo(offset.get(0), offset.get(1), ctx, renderer);
                    oldRender( false );
                };

                rocketCam
                    .addToStack( sheep )
                    // .addToStack( rocket.gravometer )
                    ;

                // water
                //

                var water = [];
                var addWater = Physics.util.throttle(function(){
                    var w = Physics.body('circle', {
                        tag: 'water'
                        ,x: - 45
                        ,y: - 60
                        ,vx: 0.04
                        ,radius: 3
                        ,styles: {
                            strokeWidth: 0
                            ,fillStyle: 'rgba(40, 136, 228, 0.85)'
                        }
                    });
                    w.state.pos.vadd( rocket.edge.body.state.pos );
                    w.state.vel.vadd( rocket.edge.body.state.vel );
                    water.push( w );
                    world.add( w );
                    renderer.layers.main.addToStack( w );
                    rocketCam.addToStack( w );
                    rocket.edge.applyTo( water.concat(sheep) );
                }, 500);

                world.on('step', addWater);

                world.on('collisions:detected', function( data ){

                    var col, w;

                    for ( var i = 0, l = data.collisions.length; i < l; ++i ){
                        
                        col = data.collisions[ i ];

                        if ( 
                            col.bodyA.tag === 'water' && col.bodyB === rocket.edge.body ||
                            col.bodyB.tag === 'water' && col.bodyA === rocket.edge.body
                        ){
                            w = col.bodyA.tag === 'water' ? col.bodyA : col.bodyB;

                            world.remove( w );
                            water.splice( Physics.util.indexOf( water, w ), 1 );
                            rocket.edge.applyTo( water.concat(sheep) );
                            renderer.layers.main.removeFromStack( w );
                            rocketCam.removeFromStack( w );
                        }
                    }                    
                });

                // debrisField( spaceCamBody, sightRadius, [{ pos: rocket.edge.body.state.pos, halfWidth: 400, halfHeight: 400 }] );
                // debrisField( rocket.edge.body, 400, [{ pos: spaceCamBody.state.pos, halfWidth: sightRadius, halfHeight: sightRadius }] );
                
                var speedEl = document.getElementById('speed-meter')
                    ,updateSpeed = Physics.util.throttle(function(){
                        var s = rocket.edge.body.state.vel.norm() * 1000;
                        speedEl.innerText = s.toFixed(1) + ' px/s';
                    }, 200)
                    ;

                // periodic boundary
                world.on('step', function(){
                    var inv2scale = 0.5 / self.scale;
                    var bounds = {
                        minX: -viewWidth * inv2scale + rocketLayer.options.offset.get(0) - 120
                        ,maxX: viewWidth * inv2scale + rocketLayer.options.offset.get(0) + 120
                        ,minY: -viewHeight * inv2scale + rocketLayer.options.offset.get(1) - 340
                        ,maxY: viewHeight * inv2scale + rocketLayer.options.offset.get(1) + 340
                    };
                    var x = rocket.pos.get(0)
                        ,y = rocket.pos.get(1)
                        ,scratch = Physics.scratchpad()
                        ,dr = scratch.vector().set(0, 0)
                        ,targets
                        ;

                    if ( x <= bounds.minX ){
                        dr.add( bounds.maxX - bounds.minX, 0 );
                    } else if ( x > bounds.maxX ){
                        dr.sub( bounds.maxX - bounds.minX, 0 );
                    }

                    if ( y <= bounds.minY ){
                        dr.add( 0, bounds.maxY - bounds.minY );
                    } else if ( y > bounds.maxY ){
                        dr.sub( 0, bounds.maxY - bounds.minY );
                    }

                    if ( !dr.equals( Physics.vector.zero ) ){

                        rocket.pos.vadd( dr );
                        rocket.edge.body.state.old.pos.vadd( dr );
                        rocket.moveTo( rocket.pos );

                        targets = rocket.edge.getTargets();

                        for ( var i = 0, l = targets.length; i < l; ++i ){
                            
                            targets[ i ].state.pos.vadd( dr );
                            targets[ i ].state.old.pos.vadd( dr );
                        }
                    }

                    scratch.done();

                    updateSpeed();
                });
            },

            addRocket: function( x, y ){

                var aabb = Physics.aabb({
                        pos: {
                            x: x
                            ,y: y
                        }
                        ,halfWidth: 50
                        ,halfHeight: 100
                    })
                    ,edge = Physics.behavior('edge-collision-detection', {
                        aabb: aabb
                        ,restitution: 0.4
                        ,cof: 0.8
                    }).applyTo([])
                    ,anchor = Physics.body('point', {
                        treatment: 'static'
                    })
                    ,gravometer = Physics.body('circle', {
                        x: x
                        ,y: y - 120
                        ,radius: 5
                        ,styles: 'red'
                    })
                    ,constr = Physics.behavior('verlet-constraints')
                    ,rocketStyles = {
                        lineWidth: 0
                        ,strokeStyle: 'black'
                        ,fillStyle: 'rgba(200, 200, 200, 1)'
                    }
                    ,outerAABB = Physics.aabb(0, 0, 243, 663)
                    ,rocketImg = new Image()
                    ,fires = [
                        new Image()
                        ,new Image()
                        ,new Image()
                    ]
                    ,fireIdx = 0
                    ;

                rocketImg.src = require.toUrl('../../images/Rocket.png');
                fires[0].src = require.toUrl('../../images/Fire-1.png');
                fires[1].src = require.toUrl('../../images/Fire-2.png');
                fires[2].src = require.toUrl('../../images/Fire-3.png');

                setInterval(function(){
                    fireIdx = (fireIdx > 1)? 0 : fireIdx + 1;
                }, 50);

                var ret = {
                    aabb: aabb
                    ,outerAABB: outerAABB
                    ,edge: edge
                    ,pos: edge.body.state.pos
                    ,anchor: anchor
                    ,gravometer: gravometer
                    ,constr: constr
                    ,moveTo: function( pos ){
                        ret.anchor.state.pos.clone( pos ).sub( 0, 140 );
                        ret.pos.clone( pos );
                        ret.aabb._pos.clone( pos );
                        ret.outerAABB._pos.clone( pos );
                        ret.edge.setAABB( ret.aabb );
                        return ret;
                    }
                    ,drawTo: function( x, y, ctx, renderer ){

                        var fire;

                        // renderer.drawRect(x, y, ret.aabb._hw * 2, ret.aabb._hh * 2, rocketStyles, ctx);

                        ctx.save();
                        ctx.translate(x, y + 90);
                        // ctx.translate(0, 90);
                        ctx.drawImage(rocketImg, -rocketImg.width/2, -rocketImg.height/2);
                        if ( ret.thrust ){
                            fire = fires[ fireIdx ];
                            ctx.drawImage(fire, -fire.width/2, -fire.height/2);
                        }
                        ctx.restore();
                    }
                };

                ret.moveTo({ x: x, y: y });
                // constr.angleConstraint( rocket.edge.body, rocket.anchor, gravometer, 0.001 );
                // constr.distanceConstraint( rocket.edge.body, gravometer, 0.01 );
                // constr.distanceConstraint( anchor, gravometer, 1 );

                return ret;
            },

            /**
             * DomReady Callback
             * @return {void}
             */
            onDomReady : function(){

                var self = this
                    ;

                Physics(self.initPhysics.bind(self));
            }

        }, ['events']);

        return new Mediator();
    }
);




