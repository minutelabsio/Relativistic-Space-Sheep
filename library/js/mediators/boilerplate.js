define(
    [
        'require',
        'plugins/domready',
        'moddef',
        'physicsjs',
        'modules/multicanvas-renderer'
    ],
    function(
        require,
        domReady,
        M,
        Physics,
        _mcr
    ) {

        'use strict';

        var MPColors = [
            'rgb(18, 84, 151)' // blue-dark
            // ,'rgb(0, 37, 143)' // deep-blue-dark
            ,'rgb(167, 42, 34)' // red-dark
            // ,'rgb(151, 52, 29)' // red-orange-dark
            ,'rgb(159, 80, 31)' // orange-dark
            ,'rgb(64, 128, 0)' // green-dark
            ,'rgb(139, 129, 23)' // yellow-dark
        ];

        function logerr( err ){
            window.console.error( err );
        }

        // VERY crude approximation to a gaussian random number.. but fast
        var gauss = function gauss( mean, stddev ){
            var r = 2 * (Math.random() + Math.random() + Math.random()) - 3;
            return r * stddev + mean;
        };

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
            ,getCoords = function( e ){
                var offset = getElementOffset( e.target )
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

                self.initEvents();

                domReady(function(){
                    self.resolve('domready');
                });

                self.after('domready').then(function(){
                    self.onDomReady();
                }).otherwise( logerr );
            },

            /**
             * Initialize events
             * @return {void}
             */
            initEvents : function(){

                var self = this;

                
            },

            initPhysics: function( world ){

                var self = this
                    ,viewWidth = window.innerWidth
                    ,viewHeight = window.innerHeight
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
            
                    viewportBounds = Physics.aabb(0, 0, viewWidth, viewHeight);
                    edgeBounce.setAABB(viewportBounds);
            
                }, true);
                
                // subscribe to ticker to advance the simulation
                Physics.util.ticker.on(function (time, dt) {
            
                    world.step(time);
                });
            
                // start the ticker
                Physics.util.ticker.start();

                var sheep = [];

                for ( var i = 0, l = 5; i < l; ++i ){
                    
                    sheep.push(Physics.body('circle', {
                        x: Math.random() * viewWidth
                        ,y: Math.random() * viewHeight
                        // ,vx: Math.random() * 0.1
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

                // rocket
                var rocket = self.addRocket(viewWidth * 0.5, viewHeight * 0.5);

                renderer.layers.main
                    .addToStack( sheep )
                    .addToStack( rocket.gravometer )
                    ;

                // rocket rendering
                var rocketLayer = renderer.addLayer('rocket');
                rocketLayer.render = function(){

                    var ctx = rocketLayer.ctx
                        ,aabb = rocket.aabb
                        ;

                    ctx.clearRect(0, 0, rocketLayer.el.width, rocketLayer.el.height);
                    rocket.drawTo(aabb._pos.get(0), aabb._pos.get(1), ctx, renderer);
                };

                var drag = false
                    ,thrust = false
                    ,offset = Physics.vector()
                    ,movePos = Physics.vector()
                    ,throttleTime = 1000 / 60 | 0
                    ;

                renderer.el.addEventListener('mousedown', function(e){
                    var pos = getCoords( e )
                        ;

                    if ( rocket.outerAABB.contains( pos ) ){

                        drag = true;
                        offset.clone( pos ).vsub( rocket.pos );
                        movePos
                            .clone( getCoords( e ) )
                            .vsub( offset )
                            ;

                    } else {
                        thrust = true;
                    }
                });

                renderer.el.addEventListener('mousemove', Physics.util.throttle(function(e){
                    var pos
                        ;

                    if ( drag ){

                        movePos
                            .clone( getCoords( e ) )
                            .vsub( offset )
                            ;
                    }
                }, throttleTime));

                renderer.el.addEventListener('mouseup', function(e){
                    drag = false;
                    rocket.edge.body.state.vel.zero();
                    thrust = false;
                });

                world.on('integrate:positions', function( data ){

                    rocket.moveTo( rocket.pos );
                    
                    if ( thrust ){
                        rocket.edge.body.state.acc.set(0, -0.0001);
                    } else if ( drag ) {
                        rocket.edge.body.state.vel.clone( movePos ).vsub( rocket.pos ).mult( 1/throttleTime );
                    }

                    var scratch = Physics.scratchpad()
                        ,v = scratch.vector()
                        ;

                    // dampen the gravometer motion
                    v.clone( rocket.gravometer.state.pos ).vsub( rocket.gravometer.state.old.pos );
                    v.mult(1e-1 );
                    // rocket.gravometer.state.pos.vsub( v );
                    // rocket.gravometer.state.vel.mult( 0.9999 );

                    scratch.done();
                });

                // explicitly add the edge behavior body to the world
                rocket.edge.body.treatment = 'kinematic';
                world.add([ 
                    rocket.edge.body
                    ,rocket.gravometer
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
                    ,offset: Physics.vector(200, 200)
                });

                var oldRender = rocketCam.render;
                rocketCam.render = function(){

                    var ctx = rocketCam.ctx
                        ,aabb = rocket.aabb
                        ;

                    ctx.clearRect(0, 0, rocketCam.el.width, rocketCam.el.height);
                    rocket.drawTo(200, 200, ctx, renderer);
                    oldRender( false );
                };

                rocketCam
                    .addToStack( sheep )
                    .addToStack( rocket.gravometer )
                    ;
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
                    ,rocketBg = new Image()
                    ;

                rocketImg.src = require.toUrl('../../images/Rocket.png');
                rocketBg.src = require.toUrl('../../images/Rocket-Background.png');

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

                        // renderer.drawRect(x, y, ret.aabb._hw * 2, ret.aabb._hh * 2, rocketStyles, ctx);

                        ctx.save();
                        ctx.translate(x, y + 90);
                        ctx.drawImage(rocketBg, -rocketImg.width/2, -rocketImg.height/2);
                        // ctx.translate(0, 90);
                        ctx.drawImage(rocketImg, -rocketImg.width/2, -rocketImg.height/2);
                        ctx.restore();
                        
                        renderer.drawLine({ x: x - 30, y: y - 140 }, { x: x + 30, y: y - 140 }, 'grey', ctx);
                    }
                };

                ret.moveTo({ x: x, y: y });
                // constr.angleConstraint( rocket.edge.body, rocket.anchor, gravometer, 0.001 );
                // constr.distanceConstraint( rocket.edge.body, gravometer, 0.01 );
                constr.distanceConstraint( anchor, gravometer, 1 );

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




