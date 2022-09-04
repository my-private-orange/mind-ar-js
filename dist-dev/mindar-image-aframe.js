/******/ (() => { // webpackBootstrap
var __webpack_exports__ = {};
/*!************************************!*\
  !*** ./src/image-target/aframe.js ***!
  \************************************/
const {Controller, UI} = window.MINDAR.IMAGE;

AFRAME.registerSystem('mindar-image-system', {
  container: null,
  video: null,
  processingImage: false,

  init: function() {
    this.anchorEntities = [];
  },

  tick: function() {
  },

  setup: function({imageTargetSrc, maxTrack, showStats, uiLoading, uiScanning, uiError, missTolerance, warmupTolerance, filterMinCF, filterBeta}) {
    this.imageTargetSrc = imageTargetSrc;
    this.maxTrack = maxTrack;
    this.filterMinCF = filterMinCF;
    this.filterBeta = filterBeta;
    this.missTolerance = missTolerance;
    this.warmupTolerance = warmupTolerance;
    this.showStats = showStats;
    this.ui = new UI({uiLoading, uiScanning, uiError});
  },

  registerAnchor: function(el, targetIndex) {
    this.anchorEntities.push({el: el, targetIndex: targetIndex});
  },

  start: function() {
    this.container = this.el.sceneEl.parentNode;

    if (this.showStats) {
      this.mainStats = new Stats();
      this.mainStats.showPanel( 0 ); // 0: fps, 1: ms, 2: mb, 3+: custom
      this.mainStats.domElement.style.cssText = 'position:absolute;top:0px;left:0px;z-index:999';
      this.container.appendChild(this.mainStats.domElement);
    }

    this.ui.showLoading();
    this._startVideo();
  },

  switchTarget: function(targetIndex) {
    this.controller.interestedTargetIndex = targetIndex;
  },

  stop: function() {
    this.pause();
    const tracks = this.video.srcObject.getTracks();
    tracks.forEach(function(track) {
      track.stop();
    });
    this.video.remove();
  },

  pause: function(keepVideo=false) {
    if (!keepVideo) {
      this.video.pause();
    }
    this.controller.stopProcessVideo();
  },

  unpause: function() {
    this.video.play();
    this.controller.processVideo(this.video);
  },

  _startVideo: function() {
    this.video = document.querySelector('video');

    if (!this.video) {
      this.video = document.createElement('video');
      this.video.setAttribute('autoplay', '');
    this.video.setAttribute('muted', '');
    this.video.setAttribute('playsinline', '');
    this.video.style.position = 'absolute'
    this.video.style.top = '0px'
    this.video.style.left = '0px'
    this.video.style.zIndex = '-2'
    this.container.appendChild(this.video);
    }

    

    // if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    //   // TODO: show unsupported error
    //   this.el.emit("arError", {error: 'VIDEO_FAIL'});
    //   this.ui.showCompatibility();
    //   return;
    // }

    const constraint = {audio: false, video: {
      facingMode: 'environment',
    }};

    const onsuccess = (stream) => {
      console.log('onsuccess')
      this.video.addEventListener( 'loadedmetadata', () => {
        //console.log("video ready...", this.video);
        this.video.setAttribute('width', this.video.videoWidth);
        this.video.setAttribute('height', this.video.videoHeight);
        this._startAR();
      });
      this.video.srcObject = stream;
    }

    const onerror = (err) => {
      console.log('onerror')

      console.log("getUserMedia error", err);
      this.el.emit("arError", {error: 'VIDEO_FAIL'});
    }
    console.log('getUserMedia')
    navigator.mediaDevices && navigator.mediaDevices.getUserMedia
    ? navigator.mediaDevices.getUserMedia(constraint).then(onsuccess, onerror)
    : navigator.getUserMedia
    ? navigator.getUserMedia(constraint, onsuccess, onerror)
    : console.error(new Error('当前浏览器不支持打开摄像头'));

  },

  _startAR: async function() {
    console.log('startAR')
    const video = this.video;
    const container = this.container;

    this.controller = new Controller({
      inputWidth: video.videoWidth,
      inputHeight: video.videoHeight,
      maxTrack: this.maxTrack, 
      filterMinCF: this.filterMinCF,
      filterBeta: this.filterBeta,
      missTolerance: this.missTolerance,
      warmupTolerance: this.warmupTolerance,
      onUpdate: (data) => {
	if (data.type === 'processDone') {
	  if (this.mainStats) this.mainStats.update();
	}
	else if (data.type === 'updateMatrix') {
	  const {targetIndex, worldMatrix} = data;

	  for (let i = 0; i < this.anchorEntities.length; i++) {
	    if (this.anchorEntities[i].targetIndex === targetIndex) {
	      this.anchorEntities[i].el.updateWorldMatrix(worldMatrix, );
	      if (worldMatrix) {
		this.ui.hideScanning();
	      }
	    }
	  }
	}
      }
    });

    console.log('controller init')

    this._resize();
    console.log('resized')
    window.addEventListener('resize', this._resize.bind(this));

    const {dimensions: imageTargetDimensions} = await this.controller.addImageTargets(this.imageTargetSrc);

    console.log('add targets')
    for (let i = 0; i < this.anchorEntities.length; i++) {
      const {el, targetIndex} = this.anchorEntities[i];
      if (targetIndex < imageTargetDimensions.length) {
        el.setupMarker(imageTargetDimensions[targetIndex]);
      }
    }
    console.log('setupMarker')


    await this.controller.dummyRun(this.video);
    console.log('dummyRun')
    this.el.emit("arReady");
    this.ui.hideLoading();
    this.ui.showScanning();

    this.controller.processVideo(this.video);
  },

  _resize: function() {
    const video = this.video;
    const container = this.container;

    let vw, vh; // display css width, height
    const videoRatio = video.videoWidth / video.videoHeight;
    const containerRatio = container.clientWidth / container.clientHeight;
    if (videoRatio > containerRatio) {
      vh = container.clientHeight;
      vw = vh * videoRatio;
    } else {
      vw = container.clientWidth;
      vh = vw / videoRatio;
    }

    const proj = this.controller.getProjectionMatrix();
    const fov = 2 * Math.atan(1/proj[5] / vh * container.clientHeight ) * 180 / Math.PI; // vertical fov
    const near = proj[14] / (proj[10] - 1.0);
    const far = proj[14] / (proj[10] + 1.0);
    const ratio = proj[5] / proj[0]; // (r-l) / (t-b)
    //console.log("loaded proj: ", proj, ". fov: ", fov, ". near: ", near, ". far: ", far, ". ratio: ", ratio);
    const newAspect = container.clientWidth / container.clientHeight;
    const cameraEle = container.getElementsByTagName("a-camera")[0];
    const camera = cameraEle.getObject3D('camera');
    camera.fov = fov;
    camera.aspect = newAspect;
    camera.near = near;
    camera.far = far;
    camera.updateProjectionMatrix();
    //const newCam = new AFRAME.THREE.PerspectiveCamera(fov, newRatio, near, far);
    //camera.getObject3D('camera').projectionMatrix = newCam.projectionMatrix;

    this.video.style.top = (-(vh - container.clientHeight) / 2) + "px";
    this.video.style.left = (-(vw - container.clientWidth) / 2) + "px";
    this.video.style.width = vw + "px";
    this.video.style.height = vh + "px";
  }
});

AFRAME.registerComponent('mindar-image', {
  dependencies: ['mindar-image-system'],

  schema: {
    imageTargetSrc: {type: 'string'},
    maxTrack: {type: 'int', default: 1},
    filterMinCF: {type: 'number', default: -1},
    filterBeta: {type: 'number', default: -1},
    missTolerance: {type: 'int', default: -1},
    warmupTolerance: {type: 'int', default: -1},
    showStats: {type: 'boolean', default: false},
    autoStart: {type: 'boolean', default: true},
    uiLoading: {type: 'string', default: 'yes'},
    uiScanning: {type: 'string', default: 'yes'},
    uiError: {type: 'string', default: 'yes'},
  },

  init: function() {
    const arSystem = this.el.sceneEl.systems['mindar-image-system'];

    arSystem.setup({
      imageTargetSrc: this.data.imageTargetSrc, 
      maxTrack: this.data.maxTrack,
      filterMinCF: this.data.filterMinCF === -1? null: this.data.filterMinCF,
      filterBeta: this.data.filterBeta === -1? null: this.data.filterBeta,
      missTolerance: this.data.missTolerance === -1? null: this.data.missTolerance,
      warmupTolerance: this.data.warmupTolerance === -1? null: this.data.warmupTolerance,
      showStats: this.data.showStats,
      uiLoading: this.data.uiLoading,
      uiScanning: this.data.uiScanning,
      uiError: this.data.uiError,
    });
    if (this.data.autoStart) {
      this.el.sceneEl.addEventListener('renderstart', () => {
        arSystem.start();
      });
    }
  }
});

AFRAME.registerComponent('mindar-image-target', {
  dependencies: ['mindar-image-system'],

  schema: {
    targetIndex: {type: 'number'},
  },

  postMatrix: null, // rescale the anchor to make width of 1 unit = physical width of card

  init: function() {
    const arSystem = this.el.sceneEl.systems['mindar-image-system'];
    arSystem.registerAnchor(this, this.data.targetIndex);

    const root = this.el.object3D;
    root.visible = false;
    root.matrixAutoUpdate = false;
  },

  setupMarker([markerWidth, markerHeight]) {
    const position = new AFRAME.THREE.Vector3();
    const quaternion = new AFRAME.THREE.Quaternion();
    const scale = new AFRAME.THREE.Vector3();
    position.x = markerWidth / 2;
    position.y = markerWidth / 2 + (markerHeight - markerWidth) / 2;
    scale.x = markerWidth;
    scale.y = markerWidth;
    scale.z = markerWidth;
    this.postMatrix = new AFRAME.THREE.Matrix4();
    this.postMatrix.compose(position, quaternion, scale);
  },

  updateWorldMatrix(worldMatrix) {
    if (!this.el.object3D.visible && worldMatrix !== null) {
      this.el.emit("targetFound");
    } else if (this.el.object3D.visible && worldMatrix === null) {
      this.el.emit("targetLost");
    }

    this.el.object3D.visible = worldMatrix !== null;
    if (worldMatrix === null) {
      return;
    }
    var m = new AFRAME.THREE.Matrix4();
    m.elements = worldMatrix;
    m.multiply(this.postMatrix);
    this.el.object3D.matrix = m;
  }
});

/******/ })()
;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIndlYnBhY2s6Ly9taW5kLWFyLy4vc3JjL2ltYWdlLXRhcmdldC9hZnJhbWUuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7QUFBQSxPQUFPLGVBQWU7O0FBRXRCO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQSxHQUFHOztBQUVIO0FBQ0EsR0FBRzs7QUFFSCxtQkFBbUIsNkhBQTZIO0FBQ2hKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0Esc0JBQXNCLCtCQUErQjtBQUNyRCxHQUFHOztBQUVIO0FBQ0EsOEJBQThCLGlDQUFpQztBQUMvRCxHQUFHOztBQUVIO0FBQ0E7O0FBRUE7QUFDQTtBQUNBLG9DQUFvQztBQUNwQyxtRUFBbUUsUUFBUSxTQUFTO0FBQ3BGO0FBQ0E7O0FBRUE7QUFDQTtBQUNBLEdBQUc7O0FBRUg7QUFDQTtBQUNBLEdBQUc7O0FBRUg7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLEtBQUs7QUFDTDtBQUNBLEdBQUc7O0FBRUg7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLEdBQUc7O0FBRUg7QUFDQTtBQUNBO0FBQ0EsR0FBRzs7QUFFSDtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7QUFJQTtBQUNBO0FBQ0Esa0NBQWtDLG9CQUFvQjtBQUN0RDtBQUNBO0FBQ0E7O0FBRUEsd0JBQXdCO0FBQ3hCO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxPQUFPO0FBQ1A7QUFDQTs7QUFFQTtBQUNBOztBQUVBO0FBQ0EsK0JBQStCLG9CQUFvQjtBQUNuRDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQSxHQUFHOztBQUVIO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsVUFBVSx5QkFBeUI7O0FBRW5DLGtCQUFrQixnQ0FBZ0M7QUFDbEQ7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsS0FBSzs7QUFFTDs7QUFFQTtBQUNBO0FBQ0E7O0FBRUEsV0FBVyxrQ0FBa0M7O0FBRTdDO0FBQ0EsbUJBQW1CLGdDQUFnQztBQUNuRCxhQUFhLGdCQUFnQjtBQUM3QjtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7QUFHQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0EsR0FBRzs7QUFFSDtBQUNBO0FBQ0E7O0FBRUEsZUFBZTtBQUNmO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxLQUFLO0FBQ0w7QUFDQTtBQUNBOztBQUVBO0FBQ0Esd0ZBQXdGO0FBQ3hGO0FBQ0E7QUFDQSxvQ0FBb0M7QUFDcEM7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsQ0FBQzs7QUFFRDtBQUNBOztBQUVBO0FBQ0EscUJBQXFCLGVBQWU7QUFDcEMsZUFBZSx3QkFBd0I7QUFDdkMsa0JBQWtCLDRCQUE0QjtBQUM5QyxpQkFBaUIsNEJBQTRCO0FBQzdDLG9CQUFvQix5QkFBeUI7QUFDN0Msc0JBQXNCLHlCQUF5QjtBQUMvQyxnQkFBZ0IsZ0NBQWdDO0FBQ2hELGdCQUFnQiwrQkFBK0I7QUFDL0MsZ0JBQWdCLCtCQUErQjtBQUMvQyxpQkFBaUIsK0JBQStCO0FBQ2hELGNBQWMsK0JBQStCO0FBQzdDLEdBQUc7O0FBRUg7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsS0FBSztBQUNMO0FBQ0E7QUFDQTtBQUNBLE9BQU87QUFDUDtBQUNBO0FBQ0EsQ0FBQzs7QUFFRDtBQUNBOztBQUVBO0FBQ0Esa0JBQWtCLGVBQWU7QUFDakMsR0FBRzs7QUFFSDs7QUFFQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0EsR0FBRzs7QUFFSDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsR0FBRzs7QUFFSDtBQUNBO0FBQ0E7QUFDQSxLQUFLO0FBQ0w7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxDQUFDIiwiZmlsZSI6Im1pbmRhci1pbWFnZS1hZnJhbWUuanMiLCJzb3VyY2VzQ29udGVudCI6WyJjb25zdCB7Q29udHJvbGxlciwgVUl9ID0gd2luZG93Lk1JTkRBUi5JTUFHRTtcblxuQUZSQU1FLnJlZ2lzdGVyU3lzdGVtKCdtaW5kYXItaW1hZ2Utc3lzdGVtJywge1xuICBjb250YWluZXI6IG51bGwsXG4gIHZpZGVvOiBudWxsLFxuICBwcm9jZXNzaW5nSW1hZ2U6IGZhbHNlLFxuXG4gIGluaXQ6IGZ1bmN0aW9uKCkge1xuICAgIHRoaXMuYW5jaG9yRW50aXRpZXMgPSBbXTtcbiAgfSxcblxuICB0aWNrOiBmdW5jdGlvbigpIHtcbiAgfSxcblxuICBzZXR1cDogZnVuY3Rpb24oe2ltYWdlVGFyZ2V0U3JjLCBtYXhUcmFjaywgc2hvd1N0YXRzLCB1aUxvYWRpbmcsIHVpU2Nhbm5pbmcsIHVpRXJyb3IsIG1pc3NUb2xlcmFuY2UsIHdhcm11cFRvbGVyYW5jZSwgZmlsdGVyTWluQ0YsIGZpbHRlckJldGF9KSB7XG4gICAgdGhpcy5pbWFnZVRhcmdldFNyYyA9IGltYWdlVGFyZ2V0U3JjO1xuICAgIHRoaXMubWF4VHJhY2sgPSBtYXhUcmFjaztcbiAgICB0aGlzLmZpbHRlck1pbkNGID0gZmlsdGVyTWluQ0Y7XG4gICAgdGhpcy5maWx0ZXJCZXRhID0gZmlsdGVyQmV0YTtcbiAgICB0aGlzLm1pc3NUb2xlcmFuY2UgPSBtaXNzVG9sZXJhbmNlO1xuICAgIHRoaXMud2FybXVwVG9sZXJhbmNlID0gd2FybXVwVG9sZXJhbmNlO1xuICAgIHRoaXMuc2hvd1N0YXRzID0gc2hvd1N0YXRzO1xuICAgIHRoaXMudWkgPSBuZXcgVUkoe3VpTG9hZGluZywgdWlTY2FubmluZywgdWlFcnJvcn0pO1xuICB9LFxuXG4gIHJlZ2lzdGVyQW5jaG9yOiBmdW5jdGlvbihlbCwgdGFyZ2V0SW5kZXgpIHtcbiAgICB0aGlzLmFuY2hvckVudGl0aWVzLnB1c2goe2VsOiBlbCwgdGFyZ2V0SW5kZXg6IHRhcmdldEluZGV4fSk7XG4gIH0sXG5cbiAgc3RhcnQ6IGZ1bmN0aW9uKCkge1xuICAgIHRoaXMuY29udGFpbmVyID0gdGhpcy5lbC5zY2VuZUVsLnBhcmVudE5vZGU7XG5cbiAgICBpZiAodGhpcy5zaG93U3RhdHMpIHtcbiAgICAgIHRoaXMubWFpblN0YXRzID0gbmV3IFN0YXRzKCk7XG4gICAgICB0aGlzLm1haW5TdGF0cy5zaG93UGFuZWwoIDAgKTsgLy8gMDogZnBzLCAxOiBtcywgMjogbWIsIDMrOiBjdXN0b21cbiAgICAgIHRoaXMubWFpblN0YXRzLmRvbUVsZW1lbnQuc3R5bGUuY3NzVGV4dCA9ICdwb3NpdGlvbjphYnNvbHV0ZTt0b3A6MHB4O2xlZnQ6MHB4O3otaW5kZXg6OTk5JztcbiAgICAgIHRoaXMuY29udGFpbmVyLmFwcGVuZENoaWxkKHRoaXMubWFpblN0YXRzLmRvbUVsZW1lbnQpO1xuICAgIH1cblxuICAgIHRoaXMudWkuc2hvd0xvYWRpbmcoKTtcbiAgICB0aGlzLl9zdGFydFZpZGVvKCk7XG4gIH0sXG5cbiAgc3dpdGNoVGFyZ2V0OiBmdW5jdGlvbih0YXJnZXRJbmRleCkge1xuICAgIHRoaXMuY29udHJvbGxlci5pbnRlcmVzdGVkVGFyZ2V0SW5kZXggPSB0YXJnZXRJbmRleDtcbiAgfSxcblxuICBzdG9wOiBmdW5jdGlvbigpIHtcbiAgICB0aGlzLnBhdXNlKCk7XG4gICAgY29uc3QgdHJhY2tzID0gdGhpcy52aWRlby5zcmNPYmplY3QuZ2V0VHJhY2tzKCk7XG4gICAgdHJhY2tzLmZvckVhY2goZnVuY3Rpb24odHJhY2spIHtcbiAgICAgIHRyYWNrLnN0b3AoKTtcbiAgICB9KTtcbiAgICB0aGlzLnZpZGVvLnJlbW92ZSgpO1xuICB9LFxuXG4gIHBhdXNlOiBmdW5jdGlvbihrZWVwVmlkZW89ZmFsc2UpIHtcbiAgICBpZiAoIWtlZXBWaWRlbykge1xuICAgICAgdGhpcy52aWRlby5wYXVzZSgpO1xuICAgIH1cbiAgICB0aGlzLmNvbnRyb2xsZXIuc3RvcFByb2Nlc3NWaWRlbygpO1xuICB9LFxuXG4gIHVucGF1c2U6IGZ1bmN0aW9uKCkge1xuICAgIHRoaXMudmlkZW8ucGxheSgpO1xuICAgIHRoaXMuY29udHJvbGxlci5wcm9jZXNzVmlkZW8odGhpcy52aWRlbyk7XG4gIH0sXG5cbiAgX3N0YXJ0VmlkZW86IGZ1bmN0aW9uKCkge1xuICAgIHRoaXMudmlkZW8gPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCd2aWRlbycpO1xuXG4gICAgaWYgKCF0aGlzLnZpZGVvKSB7XG4gICAgICB0aGlzLnZpZGVvID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgndmlkZW8nKTtcbiAgICAgIHRoaXMudmlkZW8uc2V0QXR0cmlidXRlKCdhdXRvcGxheScsICcnKTtcbiAgICB0aGlzLnZpZGVvLnNldEF0dHJpYnV0ZSgnbXV0ZWQnLCAnJyk7XG4gICAgdGhpcy52aWRlby5zZXRBdHRyaWJ1dGUoJ3BsYXlzaW5saW5lJywgJycpO1xuICAgIHRoaXMudmlkZW8uc3R5bGUucG9zaXRpb24gPSAnYWJzb2x1dGUnXG4gICAgdGhpcy52aWRlby5zdHlsZS50b3AgPSAnMHB4J1xuICAgIHRoaXMudmlkZW8uc3R5bGUubGVmdCA9ICcwcHgnXG4gICAgdGhpcy52aWRlby5zdHlsZS56SW5kZXggPSAnLTInXG4gICAgdGhpcy5jb250YWluZXIuYXBwZW5kQ2hpbGQodGhpcy52aWRlbyk7XG4gICAgfVxuXG4gICAgXG5cbiAgICAvLyBpZiAoIW5hdmlnYXRvci5tZWRpYURldmljZXMgfHwgIW5hdmlnYXRvci5tZWRpYURldmljZXMuZ2V0VXNlck1lZGlhKSB7XG4gICAgLy8gICAvLyBUT0RPOiBzaG93IHVuc3VwcG9ydGVkIGVycm9yXG4gICAgLy8gICB0aGlzLmVsLmVtaXQoXCJhckVycm9yXCIsIHtlcnJvcjogJ1ZJREVPX0ZBSUwnfSk7XG4gICAgLy8gICB0aGlzLnVpLnNob3dDb21wYXRpYmlsaXR5KCk7XG4gICAgLy8gICByZXR1cm47XG4gICAgLy8gfVxuXG4gICAgY29uc3QgY29uc3RyYWludCA9IHthdWRpbzogZmFsc2UsIHZpZGVvOiB7XG4gICAgICBmYWNpbmdNb2RlOiAnZW52aXJvbm1lbnQnLFxuICAgIH19O1xuXG4gICAgY29uc3Qgb25zdWNjZXNzID0gKHN0cmVhbSkgPT4ge1xuICAgICAgY29uc29sZS5sb2coJ29uc3VjY2VzcycpXG4gICAgICB0aGlzLnZpZGVvLmFkZEV2ZW50TGlzdGVuZXIoICdsb2FkZWRtZXRhZGF0YScsICgpID0+IHtcbiAgICAgICAgLy9jb25zb2xlLmxvZyhcInZpZGVvIHJlYWR5Li4uXCIsIHRoaXMudmlkZW8pO1xuICAgICAgICB0aGlzLnZpZGVvLnNldEF0dHJpYnV0ZSgnd2lkdGgnLCB0aGlzLnZpZGVvLnZpZGVvV2lkdGgpO1xuICAgICAgICB0aGlzLnZpZGVvLnNldEF0dHJpYnV0ZSgnaGVpZ2h0JywgdGhpcy52aWRlby52aWRlb0hlaWdodCk7XG4gICAgICAgIHRoaXMuX3N0YXJ0QVIoKTtcbiAgICAgIH0pO1xuICAgICAgdGhpcy52aWRlby5zcmNPYmplY3QgPSBzdHJlYW07XG4gICAgfVxuXG4gICAgY29uc3Qgb25lcnJvciA9IChlcnIpID0+IHtcbiAgICAgIGNvbnNvbGUubG9nKCdvbmVycm9yJylcblxuICAgICAgY29uc29sZS5sb2coXCJnZXRVc2VyTWVkaWEgZXJyb3JcIiwgZXJyKTtcbiAgICAgIHRoaXMuZWwuZW1pdChcImFyRXJyb3JcIiwge2Vycm9yOiAnVklERU9fRkFJTCd9KTtcbiAgICB9XG4gICAgY29uc29sZS5sb2coJ2dldFVzZXJNZWRpYScpXG4gICAgbmF2aWdhdG9yLm1lZGlhRGV2aWNlcyAmJiBuYXZpZ2F0b3IubWVkaWFEZXZpY2VzLmdldFVzZXJNZWRpYVxuICAgID8gbmF2aWdhdG9yLm1lZGlhRGV2aWNlcy5nZXRVc2VyTWVkaWEoY29uc3RyYWludCkudGhlbihvbnN1Y2Nlc3MsIG9uZXJyb3IpXG4gICAgOiBuYXZpZ2F0b3IuZ2V0VXNlck1lZGlhXG4gICAgPyBuYXZpZ2F0b3IuZ2V0VXNlck1lZGlhKGNvbnN0cmFpbnQsIG9uc3VjY2Vzcywgb25lcnJvcilcbiAgICA6IGNvbnNvbGUuZXJyb3IobmV3IEVycm9yKCflvZPliY3mtY/op4jlmajkuI3mlK/mjIHmiZPlvIDmkYTlg4/lpLQnKSk7XG5cbiAgfSxcblxuICBfc3RhcnRBUjogYXN5bmMgZnVuY3Rpb24oKSB7XG4gICAgY29uc29sZS5sb2coJ3N0YXJ0QVInKVxuICAgIGNvbnN0IHZpZGVvID0gdGhpcy52aWRlbztcbiAgICBjb25zdCBjb250YWluZXIgPSB0aGlzLmNvbnRhaW5lcjtcblxuICAgIHRoaXMuY29udHJvbGxlciA9IG5ldyBDb250cm9sbGVyKHtcbiAgICAgIGlucHV0V2lkdGg6IHZpZGVvLnZpZGVvV2lkdGgsXG4gICAgICBpbnB1dEhlaWdodDogdmlkZW8udmlkZW9IZWlnaHQsXG4gICAgICBtYXhUcmFjazogdGhpcy5tYXhUcmFjaywgXG4gICAgICBmaWx0ZXJNaW5DRjogdGhpcy5maWx0ZXJNaW5DRixcbiAgICAgIGZpbHRlckJldGE6IHRoaXMuZmlsdGVyQmV0YSxcbiAgICAgIG1pc3NUb2xlcmFuY2U6IHRoaXMubWlzc1RvbGVyYW5jZSxcbiAgICAgIHdhcm11cFRvbGVyYW5jZTogdGhpcy53YXJtdXBUb2xlcmFuY2UsXG4gICAgICBvblVwZGF0ZTogKGRhdGEpID0+IHtcblx0aWYgKGRhdGEudHlwZSA9PT0gJ3Byb2Nlc3NEb25lJykge1xuXHQgIGlmICh0aGlzLm1haW5TdGF0cykgdGhpcy5tYWluU3RhdHMudXBkYXRlKCk7XG5cdH1cblx0ZWxzZSBpZiAoZGF0YS50eXBlID09PSAndXBkYXRlTWF0cml4Jykge1xuXHQgIGNvbnN0IHt0YXJnZXRJbmRleCwgd29ybGRNYXRyaXh9ID0gZGF0YTtcblxuXHQgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5hbmNob3JFbnRpdGllcy5sZW5ndGg7IGkrKykge1xuXHQgICAgaWYgKHRoaXMuYW5jaG9yRW50aXRpZXNbaV0udGFyZ2V0SW5kZXggPT09IHRhcmdldEluZGV4KSB7XG5cdCAgICAgIHRoaXMuYW5jaG9yRW50aXRpZXNbaV0uZWwudXBkYXRlV29ybGRNYXRyaXgod29ybGRNYXRyaXgsICk7XG5cdCAgICAgIGlmICh3b3JsZE1hdHJpeCkge1xuXHRcdHRoaXMudWkuaGlkZVNjYW5uaW5nKCk7XG5cdCAgICAgIH1cblx0ICAgIH1cblx0ICB9XG5cdH1cbiAgICAgIH1cbiAgICB9KTtcblxuICAgIGNvbnNvbGUubG9nKCdjb250cm9sbGVyIGluaXQnKVxuXG4gICAgdGhpcy5fcmVzaXplKCk7XG4gICAgY29uc29sZS5sb2coJ3Jlc2l6ZWQnKVxuICAgIHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKCdyZXNpemUnLCB0aGlzLl9yZXNpemUuYmluZCh0aGlzKSk7XG5cbiAgICBjb25zdCB7ZGltZW5zaW9uczogaW1hZ2VUYXJnZXREaW1lbnNpb25zfSA9IGF3YWl0IHRoaXMuY29udHJvbGxlci5hZGRJbWFnZVRhcmdldHModGhpcy5pbWFnZVRhcmdldFNyYyk7XG5cbiAgICBjb25zb2xlLmxvZygnYWRkIHRhcmdldHMnKVxuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5hbmNob3JFbnRpdGllcy5sZW5ndGg7IGkrKykge1xuICAgICAgY29uc3Qge2VsLCB0YXJnZXRJbmRleH0gPSB0aGlzLmFuY2hvckVudGl0aWVzW2ldO1xuICAgICAgaWYgKHRhcmdldEluZGV4IDwgaW1hZ2VUYXJnZXREaW1lbnNpb25zLmxlbmd0aCkge1xuICAgICAgICBlbC5zZXR1cE1hcmtlcihpbWFnZVRhcmdldERpbWVuc2lvbnNbdGFyZ2V0SW5kZXhdKTtcbiAgICAgIH1cbiAgICB9XG4gICAgY29uc29sZS5sb2coJ3NldHVwTWFya2VyJylcblxuXG4gICAgYXdhaXQgdGhpcy5jb250cm9sbGVyLmR1bW15UnVuKHRoaXMudmlkZW8pO1xuICAgIGNvbnNvbGUubG9nKCdkdW1teVJ1bicpXG4gICAgdGhpcy5lbC5lbWl0KFwiYXJSZWFkeVwiKTtcbiAgICB0aGlzLnVpLmhpZGVMb2FkaW5nKCk7XG4gICAgdGhpcy51aS5zaG93U2Nhbm5pbmcoKTtcblxuICAgIHRoaXMuY29udHJvbGxlci5wcm9jZXNzVmlkZW8odGhpcy52aWRlbyk7XG4gIH0sXG5cbiAgX3Jlc2l6ZTogZnVuY3Rpb24oKSB7XG4gICAgY29uc3QgdmlkZW8gPSB0aGlzLnZpZGVvO1xuICAgIGNvbnN0IGNvbnRhaW5lciA9IHRoaXMuY29udGFpbmVyO1xuXG4gICAgbGV0IHZ3LCB2aDsgLy8gZGlzcGxheSBjc3Mgd2lkdGgsIGhlaWdodFxuICAgIGNvbnN0IHZpZGVvUmF0aW8gPSB2aWRlby52aWRlb1dpZHRoIC8gdmlkZW8udmlkZW9IZWlnaHQ7XG4gICAgY29uc3QgY29udGFpbmVyUmF0aW8gPSBjb250YWluZXIuY2xpZW50V2lkdGggLyBjb250YWluZXIuY2xpZW50SGVpZ2h0O1xuICAgIGlmICh2aWRlb1JhdGlvID4gY29udGFpbmVyUmF0aW8pIHtcbiAgICAgIHZoID0gY29udGFpbmVyLmNsaWVudEhlaWdodDtcbiAgICAgIHZ3ID0gdmggKiB2aWRlb1JhdGlvO1xuICAgIH0gZWxzZSB7XG4gICAgICB2dyA9IGNvbnRhaW5lci5jbGllbnRXaWR0aDtcbiAgICAgIHZoID0gdncgLyB2aWRlb1JhdGlvO1xuICAgIH1cblxuICAgIGNvbnN0IHByb2ogPSB0aGlzLmNvbnRyb2xsZXIuZ2V0UHJvamVjdGlvbk1hdHJpeCgpO1xuICAgIGNvbnN0IGZvdiA9IDIgKiBNYXRoLmF0YW4oMS9wcm9qWzVdIC8gdmggKiBjb250YWluZXIuY2xpZW50SGVpZ2h0ICkgKiAxODAgLyBNYXRoLlBJOyAvLyB2ZXJ0aWNhbCBmb3ZcbiAgICBjb25zdCBuZWFyID0gcHJvalsxNF0gLyAocHJvalsxMF0gLSAxLjApO1xuICAgIGNvbnN0IGZhciA9IHByb2pbMTRdIC8gKHByb2pbMTBdICsgMS4wKTtcbiAgICBjb25zdCByYXRpbyA9IHByb2pbNV0gLyBwcm9qWzBdOyAvLyAoci1sKSAvICh0LWIpXG4gICAgLy9jb25zb2xlLmxvZyhcImxvYWRlZCBwcm9qOiBcIiwgcHJvaiwgXCIuIGZvdjogXCIsIGZvdiwgXCIuIG5lYXI6IFwiLCBuZWFyLCBcIi4gZmFyOiBcIiwgZmFyLCBcIi4gcmF0aW86IFwiLCByYXRpbyk7XG4gICAgY29uc3QgbmV3QXNwZWN0ID0gY29udGFpbmVyLmNsaWVudFdpZHRoIC8gY29udGFpbmVyLmNsaWVudEhlaWdodDtcbiAgICBjb25zdCBjYW1lcmFFbGUgPSBjb250YWluZXIuZ2V0RWxlbWVudHNCeVRhZ05hbWUoXCJhLWNhbWVyYVwiKVswXTtcbiAgICBjb25zdCBjYW1lcmEgPSBjYW1lcmFFbGUuZ2V0T2JqZWN0M0QoJ2NhbWVyYScpO1xuICAgIGNhbWVyYS5mb3YgPSBmb3Y7XG4gICAgY2FtZXJhLmFzcGVjdCA9IG5ld0FzcGVjdDtcbiAgICBjYW1lcmEubmVhciA9IG5lYXI7XG4gICAgY2FtZXJhLmZhciA9IGZhcjtcbiAgICBjYW1lcmEudXBkYXRlUHJvamVjdGlvbk1hdHJpeCgpO1xuICAgIC8vY29uc3QgbmV3Q2FtID0gbmV3IEFGUkFNRS5USFJFRS5QZXJzcGVjdGl2ZUNhbWVyYShmb3YsIG5ld1JhdGlvLCBuZWFyLCBmYXIpO1xuICAgIC8vY2FtZXJhLmdldE9iamVjdDNEKCdjYW1lcmEnKS5wcm9qZWN0aW9uTWF0cml4ID0gbmV3Q2FtLnByb2plY3Rpb25NYXRyaXg7XG5cbiAgICB0aGlzLnZpZGVvLnN0eWxlLnRvcCA9ICgtKHZoIC0gY29udGFpbmVyLmNsaWVudEhlaWdodCkgLyAyKSArIFwicHhcIjtcbiAgICB0aGlzLnZpZGVvLnN0eWxlLmxlZnQgPSAoLSh2dyAtIGNvbnRhaW5lci5jbGllbnRXaWR0aCkgLyAyKSArIFwicHhcIjtcbiAgICB0aGlzLnZpZGVvLnN0eWxlLndpZHRoID0gdncgKyBcInB4XCI7XG4gICAgdGhpcy52aWRlby5zdHlsZS5oZWlnaHQgPSB2aCArIFwicHhcIjtcbiAgfVxufSk7XG5cbkFGUkFNRS5yZWdpc3RlckNvbXBvbmVudCgnbWluZGFyLWltYWdlJywge1xuICBkZXBlbmRlbmNpZXM6IFsnbWluZGFyLWltYWdlLXN5c3RlbSddLFxuXG4gIHNjaGVtYToge1xuICAgIGltYWdlVGFyZ2V0U3JjOiB7dHlwZTogJ3N0cmluZyd9LFxuICAgIG1heFRyYWNrOiB7dHlwZTogJ2ludCcsIGRlZmF1bHQ6IDF9LFxuICAgIGZpbHRlck1pbkNGOiB7dHlwZTogJ251bWJlcicsIGRlZmF1bHQ6IC0xfSxcbiAgICBmaWx0ZXJCZXRhOiB7dHlwZTogJ251bWJlcicsIGRlZmF1bHQ6IC0xfSxcbiAgICBtaXNzVG9sZXJhbmNlOiB7dHlwZTogJ2ludCcsIGRlZmF1bHQ6IC0xfSxcbiAgICB3YXJtdXBUb2xlcmFuY2U6IHt0eXBlOiAnaW50JywgZGVmYXVsdDogLTF9LFxuICAgIHNob3dTdGF0czoge3R5cGU6ICdib29sZWFuJywgZGVmYXVsdDogZmFsc2V9LFxuICAgIGF1dG9TdGFydDoge3R5cGU6ICdib29sZWFuJywgZGVmYXVsdDogdHJ1ZX0sXG4gICAgdWlMb2FkaW5nOiB7dHlwZTogJ3N0cmluZycsIGRlZmF1bHQ6ICd5ZXMnfSxcbiAgICB1aVNjYW5uaW5nOiB7dHlwZTogJ3N0cmluZycsIGRlZmF1bHQ6ICd5ZXMnfSxcbiAgICB1aUVycm9yOiB7dHlwZTogJ3N0cmluZycsIGRlZmF1bHQ6ICd5ZXMnfSxcbiAgfSxcblxuICBpbml0OiBmdW5jdGlvbigpIHtcbiAgICBjb25zdCBhclN5c3RlbSA9IHRoaXMuZWwuc2NlbmVFbC5zeXN0ZW1zWydtaW5kYXItaW1hZ2Utc3lzdGVtJ107XG5cbiAgICBhclN5c3RlbS5zZXR1cCh7XG4gICAgICBpbWFnZVRhcmdldFNyYzogdGhpcy5kYXRhLmltYWdlVGFyZ2V0U3JjLCBcbiAgICAgIG1heFRyYWNrOiB0aGlzLmRhdGEubWF4VHJhY2ssXG4gICAgICBmaWx0ZXJNaW5DRjogdGhpcy5kYXRhLmZpbHRlck1pbkNGID09PSAtMT8gbnVsbDogdGhpcy5kYXRhLmZpbHRlck1pbkNGLFxuICAgICAgZmlsdGVyQmV0YTogdGhpcy5kYXRhLmZpbHRlckJldGEgPT09IC0xPyBudWxsOiB0aGlzLmRhdGEuZmlsdGVyQmV0YSxcbiAgICAgIG1pc3NUb2xlcmFuY2U6IHRoaXMuZGF0YS5taXNzVG9sZXJhbmNlID09PSAtMT8gbnVsbDogdGhpcy5kYXRhLm1pc3NUb2xlcmFuY2UsXG4gICAgICB3YXJtdXBUb2xlcmFuY2U6IHRoaXMuZGF0YS53YXJtdXBUb2xlcmFuY2UgPT09IC0xPyBudWxsOiB0aGlzLmRhdGEud2FybXVwVG9sZXJhbmNlLFxuICAgICAgc2hvd1N0YXRzOiB0aGlzLmRhdGEuc2hvd1N0YXRzLFxuICAgICAgdWlMb2FkaW5nOiB0aGlzLmRhdGEudWlMb2FkaW5nLFxuICAgICAgdWlTY2FubmluZzogdGhpcy5kYXRhLnVpU2Nhbm5pbmcsXG4gICAgICB1aUVycm9yOiB0aGlzLmRhdGEudWlFcnJvcixcbiAgICB9KTtcbiAgICBpZiAodGhpcy5kYXRhLmF1dG9TdGFydCkge1xuICAgICAgdGhpcy5lbC5zY2VuZUVsLmFkZEV2ZW50TGlzdGVuZXIoJ3JlbmRlcnN0YXJ0JywgKCkgPT4ge1xuICAgICAgICBhclN5c3RlbS5zdGFydCgpO1xuICAgICAgfSk7XG4gICAgfVxuICB9XG59KTtcblxuQUZSQU1FLnJlZ2lzdGVyQ29tcG9uZW50KCdtaW5kYXItaW1hZ2UtdGFyZ2V0Jywge1xuICBkZXBlbmRlbmNpZXM6IFsnbWluZGFyLWltYWdlLXN5c3RlbSddLFxuXG4gIHNjaGVtYToge1xuICAgIHRhcmdldEluZGV4OiB7dHlwZTogJ251bWJlcid9LFxuICB9LFxuXG4gIHBvc3RNYXRyaXg6IG51bGwsIC8vIHJlc2NhbGUgdGhlIGFuY2hvciB0byBtYWtlIHdpZHRoIG9mIDEgdW5pdCA9IHBoeXNpY2FsIHdpZHRoIG9mIGNhcmRcblxuICBpbml0OiBmdW5jdGlvbigpIHtcbiAgICBjb25zdCBhclN5c3RlbSA9IHRoaXMuZWwuc2NlbmVFbC5zeXN0ZW1zWydtaW5kYXItaW1hZ2Utc3lzdGVtJ107XG4gICAgYXJTeXN0ZW0ucmVnaXN0ZXJBbmNob3IodGhpcywgdGhpcy5kYXRhLnRhcmdldEluZGV4KTtcblxuICAgIGNvbnN0IHJvb3QgPSB0aGlzLmVsLm9iamVjdDNEO1xuICAgIHJvb3QudmlzaWJsZSA9IGZhbHNlO1xuICAgIHJvb3QubWF0cml4QXV0b1VwZGF0ZSA9IGZhbHNlO1xuICB9LFxuXG4gIHNldHVwTWFya2VyKFttYXJrZXJXaWR0aCwgbWFya2VySGVpZ2h0XSkge1xuICAgIGNvbnN0IHBvc2l0aW9uID0gbmV3IEFGUkFNRS5USFJFRS5WZWN0b3IzKCk7XG4gICAgY29uc3QgcXVhdGVybmlvbiA9IG5ldyBBRlJBTUUuVEhSRUUuUXVhdGVybmlvbigpO1xuICAgIGNvbnN0IHNjYWxlID0gbmV3IEFGUkFNRS5USFJFRS5WZWN0b3IzKCk7XG4gICAgcG9zaXRpb24ueCA9IG1hcmtlcldpZHRoIC8gMjtcbiAgICBwb3NpdGlvbi55ID0gbWFya2VyV2lkdGggLyAyICsgKG1hcmtlckhlaWdodCAtIG1hcmtlcldpZHRoKSAvIDI7XG4gICAgc2NhbGUueCA9IG1hcmtlcldpZHRoO1xuICAgIHNjYWxlLnkgPSBtYXJrZXJXaWR0aDtcbiAgICBzY2FsZS56ID0gbWFya2VyV2lkdGg7XG4gICAgdGhpcy5wb3N0TWF0cml4ID0gbmV3IEFGUkFNRS5USFJFRS5NYXRyaXg0KCk7XG4gICAgdGhpcy5wb3N0TWF0cml4LmNvbXBvc2UocG9zaXRpb24sIHF1YXRlcm5pb24sIHNjYWxlKTtcbiAgfSxcblxuICB1cGRhdGVXb3JsZE1hdHJpeCh3b3JsZE1hdHJpeCkge1xuICAgIGlmICghdGhpcy5lbC5vYmplY3QzRC52aXNpYmxlICYmIHdvcmxkTWF0cml4ICE9PSBudWxsKSB7XG4gICAgICB0aGlzLmVsLmVtaXQoXCJ0YXJnZXRGb3VuZFwiKTtcbiAgICB9IGVsc2UgaWYgKHRoaXMuZWwub2JqZWN0M0QudmlzaWJsZSAmJiB3b3JsZE1hdHJpeCA9PT0gbnVsbCkge1xuICAgICAgdGhpcy5lbC5lbWl0KFwidGFyZ2V0TG9zdFwiKTtcbiAgICB9XG5cbiAgICB0aGlzLmVsLm9iamVjdDNELnZpc2libGUgPSB3b3JsZE1hdHJpeCAhPT0gbnVsbDtcbiAgICBpZiAod29ybGRNYXRyaXggPT09IG51bGwpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgdmFyIG0gPSBuZXcgQUZSQU1FLlRIUkVFLk1hdHJpeDQoKTtcbiAgICBtLmVsZW1lbnRzID0gd29ybGRNYXRyaXg7XG4gICAgbS5tdWx0aXBseSh0aGlzLnBvc3RNYXRyaXgpO1xuICAgIHRoaXMuZWwub2JqZWN0M0QubWF0cml4ID0gbTtcbiAgfVxufSk7XG4iXSwic291cmNlUm9vdCI6IiJ9