var wwd = new WorldWind.WorldWindow("canvasOne");
// wwd layers
var layers = [
    {layer: new WorldWind.BMNGOneImageLayer(), enabled: true},
    {layer: new WorldWind.BMNGLandsatLayer(), enabled: true},
    {layer: new WorldWind.BingAerialWithLabelsLayer(null), enabled: true},
    {layer: new WorldWind.AtmosphereLayer(), enabled: true},
    {layer: new WorldWind.CoordinatesDisplayLayer(wwd), enabled: true},
    {layer: new WorldWind.BMNGOneImageLayer(), enabled: true},

]


wwd.addLayer(new WorldWind.BMNGOneImageLayer());
wwd.addLayer(new WorldWind.BMNGLandsatLayer());
wwd.addLayer(new WorldWind.BingAerialWithLabelsLayer(null));
wwd.addLayer(new WorldWind.AtmosphereLayer());
//wwd.addLayer(new WorldWind.CompassLayer());
wwd.addLayer(new WorldWind.CoordinatesDisplayLayer(wwd));
//wwd.addLayer(new WorldWind.ViewControlsLayer(wwd));

var serviceAddress = "https://neo.sci.gsfc.nasa.gov/wms/wms?SERVICE=WMS&REQUEST=GetCapabilities&VERSION=1.3.0";
var layerName = "MOD14A1_M_FIRE";

var createLayer = function (xmlDom) {
    var wms = new WorldWind.WmsCapabilities(xmlDom);
    var wmsLayerCapabilities = wms.getNamedLayer(layerName);
    var wmsConfig = WorldWind.WmsLayer.formLayerConfiguration(wmsLayerCapabilities);
    var wmsLayer = new WorldWind.WmsLayer(wmsConfig);
    wwd.addLayer(wmsLayer);
};

var logError = function(jqXhr, text, exception) {
    console.log("Failure retriving capabilities: " + text + " exception: " + exception);
};

var enabledheat = false;
$(document).ready(function(){
    $("#test_button").click(function() {
        console.log("working");
        enabledheat = !enabledheat;
        var heatLayer = "MOD14A1_M_FIRE";
        if (enabledheat) {
            console.log("XD");
            wwd.addLayer(heatLayer);

        } else {
            console.log('not xd');
            wwd.remove(heatLayer);
        }
    });
});

$.get(serviceAddress).done(createLayer).fail(logError);
