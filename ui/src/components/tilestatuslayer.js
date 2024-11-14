import * as fgtile from './fgtile'

const getOneOneBounds = (oneone) => {
    // Regex to parse the parts in format (e|w)(number)(n|s)(number)
    const match = oneone.match(/([ew])(\d+)([ns])(\d+)/i);
    if (!match) {
        throw new Error("Invalid oneone format");
    }

    const [_, lonDir, lonVal, latDir, latVal] = match;
    let longitude = parseInt(lonVal, 10);
    let latitude = parseInt(latVal, 10);

    // Setze die Werte je nach Richtung positiv oder negativ
    if (lonDir.toLowerCase() === 'w') longitude *= -1;
    if (latDir.toLowerCase() === 's') latitude *= -1;

    return {
        s: latitude,
        n: latitude + 1,
        w: longitude,
        e: longitude + 1,
    };
}

L.TileStatusLayer = L.FeatureGroup.extend({
    onAdd(map) {
        L.FeatureGroup.prototype.onAdd.call(this, map);
        this._map = map;
        map.on("render-oneone", this.renderOneOne, this );
        map.on("render-tenten", this.renderTenTen, this);
        map.on("modify-tile", this.renderModifyTile, this);
    },

    onRemove(map) {
        map.off("modify-tile", this.renderModifyTile, this);
        map.off("render-tenten", this.renderTenTen, this);
        map.off("render-oneone", this.renderOneOne, this);
        L.FeatureGroup.prototype.onRemove.call(this, map);
    },

    renderModifyTile(evt) {
        // check zoom level
        const isSingleTileVisible = this._map.getZoom() >= 8;
        const { item } = evt.data;
        if( isSingleTileVisible ) this.renderTile( item.tile, item.status );
    },

    findTile(tile) {
        const l = Object.keys(this._layers);
        const layerId = l.find(x => this._layers[x]._tile == tile, this);
        if (layerId) return this._layers[layerId];
    },

    removeTiles() {
        let _l;
        while( (_l = Object.keys(this._layers).find(x => this._layers[x]._tile)) !== undefined )
            this._layers[_l].removeFrom(this);
    },

    removeOneOnes() {
        let _l;
        while ((_l = Object.keys(this._layers).find(x => this._layers[x]._oneone)) !== undefined)
            this._layers[_l].removeFrom(this);
    },

    findOneOne(oneone) {
        const l = Object.keys(this._layers);
        const layerId = l.find(x => this._layers[x]._oneone == oneone, this);
        if (layerId) return this._layers[layerId];
    },

    renderTenTen(evt) {
        this.removeTiles();
        Object.keys(evt.data).forEach(key => {
            const tenten = evt.data[key];
            Object.keys(tenten).forEach(oneone => {
                let tileLayer = this.findOneOne(oneone);
                if (tileLayer) tileLayer.removeFrom(this);

                const b = getOneOneBounds(oneone);
                const status = tenten[oneone];
                let cls = 'none';
                if( status.error ) cls = 'error';
                else if (status.inprogress) cls = 'inprogress';
                else if (status.rebuild) cls = 'rebuild';
                else if( status.done ) cls = 'done';
                const tr = L.rectangle([[b.s, b.w], [b.n, b.e]], {
                    className: `status-${cls}`,
                    interactive: false,
                });
                tr._oneone = oneone;
                tr.addTo(this);
            });
        })
    },

    renderOneOne(evt) {
        const me = this;
        this.removeTiles();
        Object.keys(evt.data).forEach(key => {
            const oneone = evt.data[key];
            Object.keys(oneone).forEach(status => {
                const tiles = oneone[status];
                tiles.forEach(tile => {
                    this.renderTile(tile, status);
                }, this);
            }, this);
        }, this);
    },

    renderTile(tile, status) {
        console.log("render tile", tile, status)
        // remove existing tile
        let tileLayer = this.findTile(tile);
        if (tileLayer) tileLayer.removeFrom(this);

        const b = fgtile.getTileBounds(tile);
        const tr = L.rectangle([[b.s, b.w], [b.n, b.e]], {
            className: `status-${status}`,
            interactive: false,
        });
        tr._tile = tile;
        // tr.bindPopup(buildTilePopup(t));
        // if (this._map.getZoom() >= 8)
        //     tr.bindTooltip('' + tile, {
        //         permanent: true,
        //         direction: "center",
        //         className: 'tile-label'
        //     }).openTooltip()
        tr.addTo(this);
    }
});

L.tileStatusLayer = function (options) {
    return new L.TileStatusLayer(null, options);
}