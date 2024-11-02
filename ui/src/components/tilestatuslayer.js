L.TileStatusLayer = L.FeatureGroup.extend({
    onAdd(map) {
        L.FeatureGroup.prototype.onAdd.call(this, map);
        this._map = map;
    },
});

L.tileStatusLayer = function (options) {
    return new L.TileStatusLayer(null, options);
}