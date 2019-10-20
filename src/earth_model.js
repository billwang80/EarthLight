$(window).resize(function () {
    if ($(window).width() >= 768) {
        $('.section-body').collapse('show');
    }
});
// Auto-collapse navbar when tab items are clicked
$('.navbar-collapse a[role="tab"]').click(function () {
    $(".navbar-collapse").collapse('hide');
});
// Auto-scroll-into-view expanded dropdown menus
$('.dropdown').on('shown.bs.dropdown', function (event) {
    event.target.scrollIntoView(false); // align to bottom   
});

$(document).ready(function () {
    WorldWind.Logger.setLoggingLevel(WorldWind.Logger.LEVEL_WARNING);

    var wwd = new WorldWind.WorldWindow("canvasOne"),
        MARKERS = "Markers",
        markersViewModel,
        globeViewModel;
    
    function findLayerByName(name) {
        var layers = wwd.layers.filter(function (layer) {
            return layer.displayName === MARKERS;
        });
        return layers[0];
    }

    function GlobeViewModel(wwd, markersViewModel) {
        var self = this;
        // Marker icons used in the marker palette 
        self.markerPalette = ko.observableArray([
            "https://cdn1.iconfinder.com/data/icons/free-98-icons/32/map-marker-128.png"
            //"https://cdn4.iconfinder.com/data/icons/navigation-2/500/Base_gps_location_map_map_marker_place-512.png"
        ]);
        // The currently selected marker icon 
        self.selectedMarkerImage = ko.observable(self.markerPalette()[0]);
        // Used for cursor style and click handling 
        self.dropIsArmed = ko.observable(false);
        //The dropCallback is supplied with the click position and the dropObject.
        self.dropCallback = null;
        // The object passed to the dropCallback 
        self.dropObject = null;
        /**
         * Adds a marker to the globe.
         */
        self.addMarker = function () {
            self.dropIsArmed(true);
            self.dropCallback = markersViewModel.dropMarkerCallback;
            self.dropObject = self.selectedMarkerImage();
        };
        // Invoke addMarker when an image is selected from the palette
        self.selectedMarkerImage.subscribe(self.addMarker);
        /**
         * Handles a click on the WorldWindow. If a "drop" action callback has been
         * defined, it invokes the function with the picked location.
         * @param {Object} event 
         */
        self.handleClick = function (event) {
            if (!self.dropIsArmed()) {
                return;
            }
            var type = event.type,
                x, y,
                pickList,
                terrain;
            // Get the clicked window coords
            switch (type) {
                case 'click':
                    x = event.clientX;
                    y = event.clientY;
                    break;
                case 'touchend':
                    if (!event.changedTouches[0]) {
                        return;
                    }
                    x = event.changedTouches[0].clientX;
                    y = event.changedTouches[0].clientY;
                    break;
            }
            if (self.dropCallback) {
                // Get all the picked items 
                pickList = wwd.pickTerrain(wwd.canvasCoordinates(x, y));
                // Terrain should be one of the items if the globe was clicked
                terrain = pickList.terrainObject();
                if (terrain) {
                    self.dropCallback(terrain.position, self.dropObject);
                }
            }
            self.dropIsArmed(false);
            event.stopImmediatePropagation();
        };
        // Assign the click handler to the WorldWind
        wwd.addEventListener('click', function (event) {
            self.handleClick(event);
        });
    }

    function LayersViewModel(wwd) {
        var self = this;

        // wwd layers
        var layer, layerCfg = [
            {layer: new WorldWind.BMNGOneImageLayer(), enabled: true},
            {layer: new WorldWind.BMNGLandsatLayer(), enabled: true},
            {layer: new WorldWind.BingAerialWithLabelsLayer(null), enabled: true},
            {layer: new WorldWind.AtmosphereLayer(), enabled: true},
            {layer: new WorldWind.RenderableLayer("Markers"), enabled: true},
            {layer: new WorldWind.CoordinatesDisplayLayer(wwd), enabled: true}
            //{layer: createLayer("MOD14A1_M_FIRE"), enabled: true}
        ];

        for (var i = 0; i < layerCfg.length; i++) {
            layer = layerCfg[i].layer;
            layer.enabled = layerCfg[i].enabled;
            layer.opacity = layerCfg[i].opacity ? layerCfg[i].opacity : 1.0;
            if (layerCfg[i].placement) {
                layer.placement = layerCfg[i].placement;
            }
            if (layerCfg[i].alignment) {
                layer.alignment = layerCfg[i].alignment;
            }
            if (layerCfg[i].disableTransparentColor) {
                layer.urlBuilder.transparent = false;
            }
            if (layerCfg[i].detailControl) {
                layer.detailControl = layerCfg[i].detailControl;
            }
            // Set the layer's view model properties
            layer.layerEnabled = ko.observable(layer.enabled);
            // Add the layer to the globe
            wwd.addLayer(layer);
        }

        // The layers collection view model
        self.layers = ko.observableArray(wwd.layers);
        // Layer item click handler
        self.toggleLayer = function (layer) {
            layer.enabled = !layer.enabled;
            layer.layerEnabled(layer.enabled); // view model
            wwd.redraw();
        };
    }

    function SearchViewModel(wwd) {
        var self = this;
        self.geocoder = new WorldWind.NominatimGeocoder();
        self.goToAnimator = new WorldWind.GoToAnimator(wwd);
        self.searchText = ko.observable('');
        self.onEnter = function (data, event) {
            if (event.keyCode === 13) {
                self.performSearch();
            }
            return true;
        };
        self.performSearch = function () {
            var queryString = self.searchText();
            if (queryString) {
                var latitude, longitude;
                if (queryString.match(WorldWind.WWUtil.latLonRegex)) {
                    var tokens = queryString.split(",");
                    latitude = parseFloat(tokens[0]);
                    longitude = parseFloat(tokens[1]);
                    self.goToAnimator.goTo(new WorldWind.Location(latitude, longitude));
                } else {
                    self.geocoder.lookup(queryString, function (geocoder, result) {
                        if (result.length > 0) {
                            latitude = parseFloat(result[0].lat);
                            longitude = parseFloat(result[0].lon);
                            self.goToAnimator.goTo(new WorldWind.Location(latitude, longitude));
                        }
                    });
                }
            }
        };
    }

    function MarkersViewModel(wwd) {
        var self = this;
        self.markers = ko.observableArray();
        // Set up the common placemark attributes.
        self.commonAttributes = new WorldWind.PlacemarkAttributes(null);
        self.commonAttributes.imageScale = 1;
        self.commonAttributes.imageOffset = new WorldWind.Offset(
            WorldWind.OFFSET_FRACTION, 0.3,
            WorldWind.OFFSET_FRACTION, 0.0);
        self.commonAttributes.imageColor = WorldWind.Color.WHITE;
        self.commonAttributes.labelAttributes.offset = new WorldWind.Offset(
            WorldWind.OFFSET_FRACTION, 0.5,
            WorldWind.OFFSET_FRACTION, 1.0);
        self.commonAttributes.labelAttributes.color = WorldWind.Color.YELLOW;
        self.commonAttributes.drawLeaderLine = true;
        self.commonAttributes.leaderLineAttributes.outlineColor = WorldWind.Color.RED;
        /**
         * "Drop" action callback creates and adds a marker (WorldWind.Placemark) to the globe. 
         * 
         * @param {WorldWind.Location} position
         * @param {type} imageSource
         */
        self.dropMarkerCallback = function (position, imageSource) {
            var attributes = new WorldWind.PlacemarkAttributes(self.commonAttributes),
                placemark = new WorldWind.Placemark(position, /*eyeDistanceScaling*/true, attributes),
                markerLayer = findLayerByName(MARKERS);
            // Set the placemark properties and  attributes
            placemark.label = "Lat " + position.latitude.toPrecision(4).toString() + "\n" + "Lon " + position.longitude.toPrecision(5).toString();
            placemark.altitudeMode = WorldWind.CLAMP_TO_GROUND;
            placemark.eyeDistanceScalingThreshold = 2500000;
            attributes.imageSource = imageSource;
            // Add the placemark to the layer and to the observable array
            markerLayer.addRenderable(placemark);
            self.markers.push(placemark);
        };
        /** Animator used to programmatically move the globe to a marker */
        self.goToAnimator = new WorldWind.GoToAnimator(wwd);
        /** 
         * "Goto" function centers the globe on the given marker.
         * @param {WorldWind.Placemark} marker
         */
        self.gotoMarker = function (marker) {
            self.goToAnimator.goTo(new WorldWind.Location(
                marker.position.latitude,
                marker.position.longitude));
        };
        /** 
         * "Edit" function invokes a modal dialog to edit the marker attributes.
         * @param {WorldWind.Placemark} marker 
         */
        self.editMarker = function (marker) {
            // TODO bind marker to dialog, maybe create an individual marker view-model
//                        var options = {};
//                        $('#editMarkerModal').modal(options)
        };
        /** 
         * "Remove" function removes a marker from the globe.
         * @param {WorldWind.Placemark} marker 
         */
        self.removeMarker = function (marker) {
            var markerLayer = findLayerByName(MARKERS),
                i, max, placemark;
            // Find and remove the marker from the layer and the observable array
            for (i = 0, max = self.markers().length; i < max; i++) {
                placemark = markerLayer.renderables[i];
                if (placemark === marker) {
                    markerLayer.renderables.splice(i, 1);
                    self.markers.remove(marker);
                    break;
                }
            }
        };
    }

    var serviceAddress = "https://neo.sci.gsfc.nasa.gov/wms/wms?SERVICE=WMS&REQUEST=GetCapabilities&VERSION=1.3.0";
    var fire_layer = "MOD14A1_M_FIRE";
    var pollution_layer = "MOP_CO_M";
    var cloud_layer = "MODAL2_M_CLD_FR";
    var chlorophyll_layer = "MY1DMM_CHLORA";

    var createLayer = function (xmlDom) {
        var wms = new WorldWind.WmsCapabilities(xmlDom);
        var wmsLayerCapabilities = wms.getNamedLayer(chlorophyll_layer);
        var wmsConfig = WorldWind.WmsLayer.formLayerConfiguration(wmsLayerCapabilities);
        var wmsLayer = new WorldWind.WmsLayer(wmsConfig);
        wwd.addLayer(wmsLayer);
        //return wmsLayer;
    };

    var logError = function(jqXhr, text, exception) {
        console.log("Failure retriving capabilities: " + text + " exception: " + exception);
    };

    // wwd layers
    // var layers = [
    //     {layer: new WorldWind.BMNGOneImageLayer(), enabled: true},
    //     {layer: new WorldWind.BMNGLandsatLayer(), enabled: true},
    //     {layer: new WorldWind.BingAerialWithLabelsLayer(null), enabled: true},
    //     {layer: new WorldWind.AtmosphereLayer(), enabled: true},
    //     {layer: new WorldWind.CoordinatesDisplayLayer(wwd), enabled: true},
    //     {layer: new WorldWind.BMNGOneImageLayer(), enabled: true}
    //     //{layer: createLayer("MOD14A1_M_FIRE"), enabled: true}
    // ]

    // for (var i = 0; i < layers.length; i++) {
    //     layers[i].layer.enabled = layers[i].enabled;
    //     wwd.addLayer(layers[i].layer);
    // }

    // var clickRecognizer = new WorldWind.ClickRecognizer(wwd, function(recognizer) {
    //     var x = recognizer.clientX, y = recognizer.clientY;
    //     var pickList = wwd.pick(wwd.canvasCoordinates(x,y));

    //     if (pickList.objects.length == 1 && pickList.objects[0].isTerrain) {
    //         var position = pickList.objects[0].position;
    //         //goToAnimator.goTo(new WorldWind.Location(position.latitude, position.longitude));
    //         console.log(position.latitude);
    //         console.log(position.longitude);
    //     }
    // });

    //ko.applyBindings(globeViewModel, document.getElementById('globe'));

    markersViewModel = new MarkersViewModel(wwd);
    globeViewModel = new GlobeViewModel(wwd, markersViewModel);

    ko.applyBindings(new LayersViewModel(wwd), document.getElementById('layers'));
    ko.applyBindings(markersViewModel, document.getElementById('markers'));
    ko.applyBindings(globeViewModel, document.getElementById('globe'));

    //var layer_manager = new LayerManager(wwd);
    $.get(serviceAddress).done(createLayer).fail(logError);
});