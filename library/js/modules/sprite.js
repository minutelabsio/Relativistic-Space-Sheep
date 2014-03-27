define(function(){

    function Sprite( images, fps ){

        this._frames = [];
        this._offset = { x: 0, y: 0 };
        this._index = 0;
        this._past = 0;

        for ( var i = 0, l = images.length; i < l; ++i ){
            
            this.addImage( images[i] );
        }

        this.fps( fps || 60 );
    }

    Sprite.prototype = {
        addImage: function( img ){
            var frame = img;
            if ( typeof img === 'string' ){
                frame = new Image();
                frame.src = img;
            }

            this._len = this._frames.push( frame );
        }
        ,drawTo: function( ctx, x, y, ang, flip ){

            var img = this._frames[ this.nextFrame() ];
            x = x | 0;
            y = y | 0;
            ang = +ang;

            ctx.save();
            ctx.translate(x + this._offset.x, y + this._offset.y);
            if ( flip ){
                ctx.scale( -1, 1 );
            }
            ctx.rotate( ang );
            ctx.drawImage(img, -img.width * 0.5, -img.height * 0.5);
            ctx.restore();
        }
        ,nextFrame: function(){
            var next = this._index
                ,now = Date.now()
                ;

            if ( (now - this._past) > this._mspf ){
                next++;
                if ( next >= this._len ){
                    next = 0;
                }
                this._index = next;
                this._past = now;
            }

            return next;
        }
        ,offset: function( os ){
            if ( os === undefined ){
                return this._offset;
            }

            this._offset.x = os.x|0;
            this._offset.y = os.y|0;

            return this;
        }
        ,fps: function( fps ){
            if ( fps === undefined ){
                return this._fps;
            }

            this._fps = fps | 0;
            this._mspf = (1000 / fps) | 0;

            return this;
        }
    };

    return Sprite;
});