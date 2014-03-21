define(
    [
        'physicsjs'
    ],
    function(
        Physics
    ){

        Physics.renderer('multicanvas', 'canvas', function( parent ){

            return {

                init: function( options ){

                    parent.init.call( this, options );

                    this.layers = {};
                    this.addLayer( 'main', this.el );
                    this.resize( this.options.width, this.options.height );
                },

                addLayer: function( id, el, opts ){

                    var self = this
                        ,bodies = []
                        ,styles = Physics.util.extend({}, this.options.styles)
                        ,layer = {
                            id: id
                            ,el: el || document.createElement('canvas')
                            ,options: Physics.util.options({
                                width: this.el.width,
                                height: this.el.height,
                                manual: false,
                                autoResize: true,
                                follow: null
                            })( opts )
                        }
                        ;

                    if ( id in this.layers ){
                        throw 'Layer "'+id+'" already added.';
                    }

                    this.el.parentNode.appendChild( layer.el );
                    layer.el.className += ' physics-layer-' + layer.id;
                    layer.ctx = layer.el.getContext('2d');
                    layer.el.width = layer.options.width;
                    layer.el.height = layer.options.height;

                    layer.reset = function( arr ){

                        bodies = arr || [];
                    };

                    layer.addToStack = function( thing ){

                        if ( Physics.util.isArray( thing ) ){
                            bodies.push.apply(bodies, thing);
                        } else {
                            bodies.push( thing );
                        }
                        return layer;
                    };

                    layer.removeFromStack = function( thing ){

                        var i, l;

                        if ( Physics.util.isArray( thing ) ){
                            for ( i = 0, l = thing.length; i < l; ++i ){
                                
                                layer.removeFromStack(thing[ i ]);
                            }
                        } else {
                            i = Physics.util.indexOf( bodies, thing );
                            if ( i > -1 ){
                                bodies.splice( i, 1 );
                            }
                        }
                        return layer;
                    };

                    layer.render = function( clear ){

                        var body
                            ,scratch = Physics.scratchpad()
                            ,offset = scratch.vector().set(0, 0)
                            ;

                        if ( layer.options.manual ){
                            scratch.done();
                            return layer;
                        }

                        if ( layer.options.follow ){
                            offset.vsub( layer.options.follow.state.pos );
                        }

                        if ( layer.options.offset ){
                            offset.vadd( layer.options.offset );
                        }

                        if ( clear !== false ){
                            layer.ctx.clearRect(0, 0, layer.el.width, layer.el.height);
                        }

                        for ( var i = 0, l = bodies.length; i < l; ++i ){
                            
                            body = bodies[ i ];
                            view = body.view || ( body.view = self.createView(body.geometry, body.styles || styles[ body.geometry.name ]) );
                            self.drawBody( body, body.view, layer.ctx, offset );
                        }

                        scratch.done();
                        return layer;
                    };

                    // remember layer
                    this.layers[ id ] = layer;

                    return layer;
                },

                resize: function( width, height ){

                    var layer;

                    for ( var id in this.layers ){
                        
                        layer = this.layers[ id ];
                        if ( layer.options.autoResize ){
                            layer.el.width = width;
                            layer.el.height = height;
                        }
                    }
                },

                /**
                 * Render the world bodies and meta. Called by world.render()
                 * @param  {Array} bodies Array of bodies in the world (reference!)
                 * @param  {Object} meta  meta object
                 * @return {this}
                 */
                render: function( bodies, meta ){

                    var body
                        ,view
                        ,pos
                        ;

                    this._world.emit('beforeRender', {
                        renderer: this,
                        meta: meta
                    });

                    if (this.options.meta){
                        this.drawMeta( meta );
                    }

                    for ( var id in this.layers ){
                        
                        this.layers[ id ].render();
                    }

                    return this;
                },
            };
        });
    }
);