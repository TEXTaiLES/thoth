class Label extends ATON.Node { 
    constructor(uiid, text, options = {}) {
        super(uiid, ATON.NTYPES.UI);
        
        this._opts = {
            fontSize    : options.fontSize || 32,
            fontFamily  : options.fontFamily || 'Arial',
            textColor   : options.textColor || '#ffffff',
            bgColor     : options.bgColor || '#000000',
            bgAlpha     : options.bgAlpha || 0.7,
            padding     : options.padding || 10,
            borderRadius: options.borderRadius || 5,
            scale       : options.scale || 1
        };
        
        this._text            = text || "";
        this._canvas          = null;
        this._context         = null;
        this._texture         = null;
        this._sprite          = null;
        this._bAutoOrient     = true;
        this._bAlwaysPickable = true;
        
        this._createLabel();
        // this.bringToFront();
    }
    
    _createLabel() {
        this._canvas  = document.createElement('canvas');
        this._context = this._canvas.getContext('2d');
        
        this._updateCanvas();
        
        this._texture = new THREE.CanvasTexture(this._canvas);
        this._texture.needsUpdate = true;
        
        const spriteMaterial = new THREE.SpriteMaterial({ 
            map        : this._texture,
            transparent: true,
            depthTest  : false,
            depthWrite : false
        });
        
        this._sprite = new THREE.Sprite(spriteMaterial);
        
        const originalRaycast = this._sprite.raycast.bind(this._sprite);
        
        this._sprite.raycast = (raycaster, intersects) => {
            originalRaycast(raycaster, intersects);
            
            if (intersects.length > 0 && this._bAlwaysPickable) {
                const lastIntersect = intersects[intersects.length - 1];
                if (lastIntersect.object === this._sprite) {
                    lastIntersect.distance *= 0.0001;
                }
            }
        };
        
        this.add(this._sprite);
        this._updateSpriteScale();
    }
    
    _updateCanvas() {
        const ctx = this._context;
        const opts = this._opts;
        
        ctx.font = `${opts.fontSize}px ${opts.fontFamily}`;
        const metrics = ctx.measureText(this._text);
        const textWidth = metrics.width;
        
        this._canvas.width = textWidth + opts.padding * 2;
        this._canvas.height = opts.fontSize + opts.padding * 2;
        
        ctx.fillStyle = opts.bgColor;
        ctx.globalAlpha = opts.bgAlpha;
        ctx.beginPath();
        ctx.roundRect(0, 0, this._canvas.width, this._canvas.height, opts.borderRadius);
        ctx.fill();
        
        ctx.globalAlpha = 1.0;
        ctx.fillStyle = opts.textColor;
        ctx.font = `${opts.fontSize}px ${opts.fontFamily}`;
        ctx.textBaseline = 'middle';
        ctx.fillText(this._text, opts.padding, this._canvas.height / 2);
        
        if (this._texture) {
            this._texture.needsUpdate = true;
        }
    }
    
    _updateSpriteScale() {
        if (!this._sprite) return;
        
        const aspect = this._canvas.width / this._canvas.height;
        this._sprite.scale.set(aspect * this._opts.scale, this._opts.scale, 1);
    }
    
    setText(text) {
        this._text = text;
        this._updateCanvas();
        this._updateSpriteScale();
        return this;
    }
    
    getText() {
        return this._text;
    }
    
    setStyle(options) {
        Object.assign(this._opts, options);
        this._updateCanvas();
        this._updateSpriteScale();
        return this;
    }
    
    getStyle() {
        return { ...this._opts };
    }
    
    autoOrientToCamera() {
        if (this._bAutoOrient && ATON.Nav && ATON.Nav._qOri) {
            this.quaternion.copy(ATON.Nav._qOri);
        }
        return this;
    }
    
    setAutoOrient(b) {
        this._bAutoOrient = b;
        return this;
    }
    
    isAutoOrient() {
        return this._bAutoOrient;
    }
    
    setOpacity(alpha) {
        if (this._sprite && this._sprite.material) {
            this._sprite.material.opacity = alpha;
        } 
        return this;
    }
    
    bringToFront() {
        this.renderOrder = ATON.RO_SUI;
        
        if (this._sprite) {
            this._sprite.renderOrder = ATON.RO_SUI;
            this._sprite.material.depthTest = false;
        }
        
        this._bAlwaysPickable = true;
        
        this.traverse((child) => {
            child.renderOrder = ATON.RO_SUI;
        });
        
        return this;
    }
    
    setDefaultRender() {
        const defaultOrder = 0;
        this.renderOrder = defaultOrder;
        
        if (this._sprite) {
            this._sprite.renderOrder = defaultOrder;
            this._sprite.material.depthTest = true;
        }
        
        this._bAlwaysPickable = false;
        
        this.traverse((child) => {
            child.renderOrder = defaultOrder;
        });
        
        return this;
    }
    
    update() {
        if (this._bAutoOrient) {
            this.autoOrientToCamera();
        }
    }
}


export default Label