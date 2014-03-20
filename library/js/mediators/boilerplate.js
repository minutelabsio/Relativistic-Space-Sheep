define(
    [
        'plugins/domready',
        'moddef',
        'physicsjs',
        'modules/multicanvas-renderer'
    ],
    function(
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
                
                world.add([
                    Physics.behavior('body-collision-detection'),
                    Physics.behavior('sweep-prune'),
                    Physics.behavior('body-impulse-response')
                ]);
            
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
                        ,radius: 5
                        ,classed: 'sheep'
                    }));
                }

                renderer.layers.main.addToStack( sheep );

                // rocket
                var rocket = self.addRocket(viewWidth * 0.5, viewHeight * 0.5);

                // rocket rendering
                var rocketLayer = renderer.addLayer('rocket');
                var rocketStyles = {
                    lineWidth: 2
                    ,strokeStyle: 'black'
                    ,fillStyle: 'rgba(0,0,0,0)'
                };
                rocketLayer.render = function(){

                    var ctx = rocketLayer.ctx
                        ,aabb = rocket.aabb
                        ;

                    ctx.clearRect(0, 0, rocketLayer.el.width, rocketLayer.el.height);
                    renderer.drawRect(aabb._pos.get(0), aabb._pos.get(1), aabb._hw * 2, aabb._hh * 2, rocketStyles, ctx);
                };

                var drag = false
                    ,thrust = false
                    ,offset = Physics.vector()
                    ,movePos = Physics.vector()
                    ,throttleTime = 1000 / 60 | 0
                    ;
                rocketLayer.el.addEventListener('mousedown', function(e){
                    var pos = getCoords( e )
                        ;

                    if ( rocket.aabb.contains( pos ) ){

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

                rocketLayer.el.addEventListener('mousemove', Physics.util.throttle(function(e){
                    var pos
                        ;

                    if ( drag ){

                        movePos
                            .clone( getCoords( e ) )
                            .vsub( offset )
                            ;
                    }
                }, throttleTime));

                rocketLayer.el.addEventListener('mouseup', function(e){
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
                });
                    
                // explicitly add the edge behavior body to the world
                rocket.edge.body.treatment = 'kinematic';
                world.add( rocket.edge.body );

                rocket.edge.applyTo( sheep );
                world.add( sheep );
                world.add( rocket.edge );
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
                    ;

                var ret = {
                    aabb: aabb
                    ,edge: edge
                    ,pos: edge.body.state.pos
                    ,moveTo: function( pos ){
                        ret.pos.clone( pos );
                        ret.aabb._pos.clone( pos );
                        ret.edge.setAABB( ret.aabb );
                        return ret;
                    }
                };

                ret.moveTo({ x: x, y: y });
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




