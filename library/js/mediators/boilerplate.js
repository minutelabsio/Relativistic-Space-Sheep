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

        var getElementOffset = function( el ){
                var curleft = 0
                    ,curtop = 0
                    ;

                if (el.offsetParent) {
                    do {
                        curleft += el.offsetLeft;
                        curtop += el.offsetTop;
                    } while (el = el.offsetParent);
                }

                return { left: curleft, top: curtop };
            }
            ,getCoords = function( e, target ){
                var offset = getElementOffset( target || e.target )
                    ,obj = ( e.changedTouches && e.changedTouches[0] ) || e
                    ,x = obj.pageX - offset.left
                    ,y = obj.pageY - offset.top
                    ;

                return {
                    x: x
                    ,y: y
                };
            }
            ;

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
                self.waterTog = true;

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
                        ,viewport = document.getElementById('viewport')
                        ;

                    viewport.tabIndex = 0;
                    viewport.focus();
                    
                    var hammertime = hammer( viewport );
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
                        viewport.focus();
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
                        e.preventDefault();
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
                        } else if ( e.target.id === 'ctrl-sheep'){
                            self.emit('sheep-toggle', toggleClass(e.target, 'on'));
                        } else if ( e.target.id === 'ctrl-water'){
                            self.waterTog = toggleClass(e.target, 'on');
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

                    viewport.addEventListener('keydown', function( e ){
                        switch ( e.keyCode ){
                            case 38: // up
                            case 87: // w
                                keys.up = 100;
                                thrustEvent();
                            break;
                            case 40: // down
                            case 83: // s
                                keys.down = 100;
                                thrustEvent();
                            break;
                            case 37: // left
                            case 65: // a
                                keys.left = 100;
                                thrustEvent();
                            break;
                            case 39: // right
                            case 68: // d
                                keys.right = 100;
                                thrustEvent();
                            break;
                        }

                        return false;
                    });

                    viewport.addEventListener('keyup', function( e ){
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

                    window.addEventListener('resize', function(){
                        self.viewWidth = window.innerWidth;
                        self.viewHeight = window.innerHeight;
                        self.emit('resize');
                    }, true);


                    var jsEl = document.getElementById('joystick')
                        ,joystick = hammer( jsEl )
                        ,jsHH = jsEl.height * 0.5
                        ,jsHW = jsEl.width * 0.5
                        ;

                    joystick.on('touch drag', Physics.util.throttle(function( e ){

                        var pos = getCoords( e.gesture.center, e.target );
                        pos.x -= jsHW;
                        pos.y -= jsHH;
                        self.emit('thrust', pos);

                    }), 50);

                    joystick.on('release', function( e ){
                        
                        self.emit('thrust', { x: 0, y: 0 });
                    });

                    hammer(document.getElementById('ctrl-dismiss-instructions')).on('touch', function(){
                        self.emit('dismiss-instructions');
                    });
                });
            },

            initPhysics: function( world ){

                var self = this
                    ,i
                    ,l
                    ,renderer = Physics.renderer('multicanvas', {
                        el: 'physics',
                        width: self.viewWidth,
                        height: self.viewHeight,
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
                self.on('resize', function () {
            
                    renderer.resize( self.viewWidth, self.viewHeight );
                });
                
                // subscribe to ticker to advance the simulation
                Physics.util.ticker.on(function (time, dt) {
            
                    world.step(time);
                });
            
                // start the ticker
                Physics.util.ticker.start();

                var sheep = [];
                for ( i = 0, l = 5; i < l; ++i ){
                    
                    sheep.push(Physics.body('circle', {
                        x: Math.random() * self.viewWidth
                        ,y: Math.random() * self.viewHeight
                        ,vx: Math.random() * 0.1
                        ,vy: Math.random() * 0.1
                        ,radius: 12
                        ,classed: 'sheep'
                        ,styles: {
                            src: require.toUrl( '../../images/Sheep.png' )
                        }
                    }));
                }

                self.on('sheep-toggle', function( e, tog ){
                    for ( i = 0, l = sheep.length; i < l; ++i ){
                        
                        sheep[i].hidden = !tog;
                    }
                });

                world.add([
                    Physics.behavior('body-collision-detection').applyTo( sheep ),
                    Physics.behavior('sweep-prune'),
                    Physics.behavior('body-impulse-response')
                ]);

                var spaceCamBody = Physics.body('point', {
                    x: self.viewWidth * 0.5
                    ,y: self.viewHeight * 0.5
                    ,treatment: 'kinematic'
                });

                world.add([
                    spaceCamBody
                ]);

                // rocket
                var rocket = self.addRocket(0, 0);

                renderer.layers.main
                    .addToStack( sheep )
                    .options({ 
                        // follow: spaceCamBody
                        scale: self.scale
                        ,offset: 'center'
                    })
                    ;

                // rocket rendering
                var rocketLayer = renderer.addLayer('rocket', null, {
                    // follow: spaceCamBody
                    scale: self.scale
                    ,offset: 'center'
                });

                rocketLayer.render = function(){

                    var ctx = rocketLayer.ctx
                        ,scratch = Physics.scratchpad()
                        ,offset = scratch.vector().set(0, 0)
                        ,scale = rocketLayer.options.scale
                        ,pos = rocket.edge.body.state.pos
                        ;

                    if ( rocketLayer.options.offset === 'center' ){
                        offset.add( rocketLayer.el.width * 0.5, rocketLayer.el.height * 0.5 ).mult( 1/scale );
                    } else {
                        offset.vadd( rocketLayer.options.offset ).mult( 1/scale );
                    }

                    if ( rocketLayer.options.follow ){
                        offset.vsub( rocketLayer.options.follow.state.pos );
                    }

                    ctx.clearRect(0, 0, rocketLayer.el.width, rocketLayer.el.height);
                    ctx.save();
                    ctx.scale( scale, scale );
                    rocket.drawTo(pos.get(0) + offset.get(0), pos.get(1) + offset.get(1), ctx, renderer);
                    ctx.restore();
                    scratch.done();
                };

                // events
                // 
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
                    orig.clone( pos ).sub( self.viewWidth/2, self.viewHeight/2 ).mult( 1 / self.scale );

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
                            rocket.edge.body.state.acc.clone( movePos ).vsub( rocket.edge.body.state.pos ).normalize().mult( 0.0001 );
                        }
                    }
                });

                // explicitly add the edge behavior body to the world
                rocket.edge.body.treatment = 'kinematic';
                world.add([ 
                    rocket.edge.body
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
                    ;

                // water
                //
                var water = []
                    ,waterView = renderer.createView( Physics.geometry('circle', {radius: 3}), {
                        strokeWidth: 0
                        ,fillStyle: 'rgba(40, 136, 228, 0.85)'
                    })
                    ,addWater = Physics.util.throttle(function(){
                        if ( !self.waterTog ){
                            return;
                        }
                        var w = Physics.body('circle', {
                            tag: 'water'
                            ,x: - 45
                            ,y: - 60
                            ,vx: 0.04
                            ,radius: 3
                            ,view: waterView
                        });
                        w.state.pos.vadd( rocket.edge.body.state.pos );
                        w.state.vel.vadd( rocket.edge.body.state.vel );
                        water.push( w );
                        world.add( w );
                        renderer.layers.main.addToStack( w );
                        rocketCam.addToStack( w );
                        rocket.edge.applyTo( water.concat(sheep) );
                    }, 250)
                    ;

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

                var speedEl = document.getElementById('speed-meter')
                    ,updateSpeed = Physics.util.throttle(function(){
                        var s = rocket.edge.body.state.vel.norm() * 1000;
                        speedEl.innerHTML = s.toFixed(1) + ' px/s';
                    }, 200)
                    ,bounds = {}
                    ,rockHW = rocket.outerAABB.halfWidth()
                    ,rockHH = rocket.outerAABB.halfHeight()
                    ;

                // periodic boundary
                world.on('step', function(){
                    
                    var inv2scale = 0.5 / self.scale
                        ,i
                        ,l
                        ,x = rocket.pos.get(0)
                        ,y = rocket.pos.get(1)
                        ,scratch = Physics.scratchpad()
                        ,dr = scratch.vector().set(0, 0)
                        ,targets
                        ;

                    bounds.maxX = ( self.viewWidth  ) * inv2scale + rockHW;
                    bounds.minX = -bounds.maxX;
                    bounds.maxY = ( self.viewHeight  ) * inv2scale + rockHH;
                    bounds.minY = -bounds.maxY;

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

                        for ( i = 0, l = targets.length; i < l; ++i ){
                            
                            targets[ i ].state.pos.vadd( dr );
                            targets[ i ].state.old.pos.vadd( dr );
                        }
                    }

                    scratch.done();
                });
    
                // update speed display
                world.on('step', updateSpeed);
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
                    ,rocketStyles = {
                        lineWidth: 0
                        ,strokeStyle: 'black'
                        ,fillStyle: 'rgba(200, 200, 200, 1)'
                    }
                    ,outerAABB = Physics.aabb(0, 0, 243, 549)
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

                var getThrustImg = Physics.util.throttle(function(){
                    fireIdx = (fireIdx > 1)? 0 : fireIdx + 1;
                    return fires[ fireIdx ];
                }, 50);

                var ret = {
                    aabb: aabb
                    ,thrust: false
                    ,outerAABB: outerAABB
                    ,edge: edge
                    ,pos: edge.body.state.pos
                    ,moveTo: function( pos ){
                        ret.pos.clone( pos );
                        ret.aabb._pos.clone( pos );
                        ret.outerAABB._pos.clone( pos ).add(0, 32);
                        ret.edge.setAABB( ret.aabb );
                        return ret;
                    }
                    ,drawTo: function( x, y, ctx, renderer ){

                        var fire;

                        ctx.save();
                        ctx.translate(x, y + 32); // 32 is rocket img shim
                        ctx.drawImage(rocketImg, -rocketImg.width/2, -rocketImg.height/2);
                        if ( ret.thrust ){
                            fire = getThrustImg();
                            ctx.translate(0, 55);
                            ctx.drawImage(fire, -fire.width/2, -fire.height/2);
                        }
                        ctx.restore();
                    }
                };

                ret.moveTo({ x: x, y: y });

                return ret;
            },

            initJoystick: function( el ){

                var self = this
                    ,ctx = el.getContext('2d')
                    ,width = el.width
                    ,height = el.height
                    ,dir = Physics.vector()
                    ,min = Physics.vector( 30, 30 )
                    ,max = Physics.vector( width, height ).sub( 30, 30 )
                    ;

                function clampNorm( v, max ){
                    var norm = v.norm();
                    if ( norm === 0 ){
                        return v;
                    }
                    return v.mult( Math.min( max, norm ) / norm );
                }

                function draw( e, r ){

                    dir.clone( r );
                    clampNorm( dir, width * 0.5 - 30 );
                    dir.add( width * 0.5, height * 0.5 );

                    ctx.clearRect(0, 0, width, height);

                    ctx.beginPath();
                    ctx.strokeStyle = ctx.fillStyle = 'rgb(167, 42, 34)';
                    ctx.arc(dir.get(0), dir.get(1), 30, 0, Math.PI * 2, false);
                    ctx.closePath();
                    ctx.stroke();
                    ctx.fill();
                }

                self.on('thrust', draw);
                draw(null, dir);
            },

            /**
             * DomReady Callback
             * @return {void}
             */
            onDomReady : function(){

                var self = this
                    ;

                self.viewWidth = window.innerWidth;
                self.viewHeight = window.innerHeight;
                Physics(self.initPhysics.bind(self));

                self.initJoystick( document.getElementById('joystick') );

                self.on('dismiss-instructions', function(){
                    var el = document.getElementById('instructions');
                    el.style.display = 'none';
                });
            }

        }, ['events']);

        return new Mediator();
    }
);




