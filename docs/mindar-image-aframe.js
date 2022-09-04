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
      this.video.addEventListener( 'loadedmetadata', () => {
        //console.log("video ready...", this.video);
        this.video.setAttribute('width', this.video.videoWidth);
        this.video.setAttribute('height', this.video.videoHeight);
        this._startAR();
      });
      this.video.srcObject = stream;
    }

    const onerror = (err) => {
      console.log("getUserMedia error", err);
      this.el.emit("arError", {error: 'VIDEO_FAIL'});
    }
    navigator.mediaDevices && navigator.mediaDevices.getUserMedia
    ? navigator.mediaDevices.getUserMedia(constraint).then(onsuccess, onerror)
    : navigator.getUserMedia
    ? navigator.getUserMedia(constraint, onsuccess, onerror)
    : console.error(new Error('当前浏览器不支持打开摄像头'));

  },

  _startAR: async function() {
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

    this._resize();
    window.addEventListener('resize', this._resize.bind(this));

    const {dimensions: imageTargetDimensions} = await this.controller.addImageTargets(this.imageTargetSrc);

    for (let i = 0; i < this.anchorEntities.length; i++) {
      const {el, targetIndex} = this.anchorEntities[i];
      if (targetIndex < imageTargetDimensions.length) {
        el.setupMarker(imageTargetDimensions[targetIndex]);
      }
    }

    await this.controller.dummyRun(this.video);
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIndlYnBhY2s6Ly9taW5kLWFyLy4vc3JjL2ltYWdlLXRhcmdldC9hZnJhbWUuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7QUFBQSxPQUFPLGVBQWU7O0FBRXRCO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQSxHQUFHOztBQUVIO0FBQ0EsR0FBRzs7QUFFSCxtQkFBbUIsNkhBQTZIO0FBQ2hKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0Esc0JBQXNCLCtCQUErQjtBQUNyRCxHQUFHOztBQUVIO0FBQ0EsOEJBQThCLGlDQUFpQztBQUMvRCxHQUFHOztBQUVIO0FBQ0E7O0FBRUE7QUFDQTtBQUNBLG9DQUFvQztBQUNwQyxtRUFBbUUsUUFBUSxTQUFTO0FBQ3BGO0FBQ0E7O0FBRUE7QUFDQTtBQUNBLEdBQUc7O0FBRUg7QUFDQTtBQUNBLEdBQUc7O0FBRUg7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLEtBQUs7QUFDTDtBQUNBLEdBQUc7O0FBRUg7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLEdBQUc7O0FBRUg7QUFDQTtBQUNBO0FBQ0EsR0FBRzs7QUFFSDtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7QUFJQTtBQUNBO0FBQ0Esa0NBQWtDLG9CQUFvQjtBQUN0RDtBQUNBO0FBQ0E7O0FBRUEsd0JBQXdCO0FBQ3hCO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsT0FBTztBQUNQO0FBQ0E7O0FBRUE7QUFDQTtBQUNBLCtCQUErQixvQkFBb0I7QUFDbkQ7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBLEdBQUc7O0FBRUg7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsVUFBVSx5QkFBeUI7O0FBRW5DLGtCQUFrQixnQ0FBZ0M7QUFDbEQ7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsS0FBSzs7QUFFTDtBQUNBOztBQUVBLFdBQVcsa0NBQWtDOztBQUU3QyxtQkFBbUIsZ0NBQWdDO0FBQ25ELGFBQWEsZ0JBQWdCO0FBQzdCO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0EsR0FBRzs7QUFFSDtBQUNBO0FBQ0E7O0FBRUEsZUFBZTtBQUNmO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxLQUFLO0FBQ0w7QUFDQTtBQUNBOztBQUVBO0FBQ0Esd0ZBQXdGO0FBQ3hGO0FBQ0E7QUFDQSxvQ0FBb0M7QUFDcEM7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsQ0FBQzs7QUFFRDtBQUNBOztBQUVBO0FBQ0EscUJBQXFCLGVBQWU7QUFDcEMsZUFBZSx3QkFBd0I7QUFDdkMsa0JBQWtCLDRCQUE0QjtBQUM5QyxpQkFBaUIsNEJBQTRCO0FBQzdDLG9CQUFvQix5QkFBeUI7QUFDN0Msc0JBQXNCLHlCQUF5QjtBQUMvQyxnQkFBZ0IsZ0NBQWdDO0FBQ2hELGdCQUFnQiwrQkFBK0I7QUFDL0MsZ0JBQWdCLCtCQUErQjtBQUMvQyxpQkFBaUIsK0JBQStCO0FBQ2hELGNBQWMsK0JBQStCO0FBQzdDLEdBQUc7O0FBRUg7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsS0FBSztBQUNMO0FBQ0E7QUFDQTtBQUNBLE9BQU87QUFDUDtBQUNBO0FBQ0EsQ0FBQzs7QUFFRDtBQUNBOztBQUVBO0FBQ0Esa0JBQWtCLGVBQWU7QUFDakMsR0FBRzs7QUFFSDs7QUFFQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0EsR0FBRzs7QUFFSDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsR0FBRzs7QUFFSDtBQUNBO0FBQ0E7QUFDQSxLQUFLO0FBQ0w7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxDQUFDIiwiZmlsZSI6Im1pbmRhci1pbWFnZS1hZnJhbWUuanMiLCJzb3VyY2VzQ29udGVudCI6WyJjb25zdCB7Q29udHJvbGxlciwgVUl9ID0gd2luZG93Lk1JTkRBUi5JTUFHRTtcblxuQUZSQU1FLnJlZ2lzdGVyU3lzdGVtKCdtaW5kYXItaW1hZ2Utc3lzdGVtJywge1xuICBjb250YWluZXI6IG51bGwsXG4gIHZpZGVvOiBudWxsLFxuICBwcm9jZXNzaW5nSW1hZ2U6IGZhbHNlLFxuXG4gIGluaXQ6IGZ1bmN0aW9uKCkge1xuICAgIHRoaXMuYW5jaG9yRW50aXRpZXMgPSBbXTtcbiAgfSxcblxuICB0aWNrOiBmdW5jdGlvbigpIHtcbiAgfSxcblxuICBzZXR1cDogZnVuY3Rpb24oe2ltYWdlVGFyZ2V0U3JjLCBtYXhUcmFjaywgc2hvd1N0YXRzLCB1aUxvYWRpbmcsIHVpU2Nhbm5pbmcsIHVpRXJyb3IsIG1pc3NUb2xlcmFuY2UsIHdhcm11cFRvbGVyYW5jZSwgZmlsdGVyTWluQ0YsIGZpbHRlckJldGF9KSB7XG4gICAgdGhpcy5pbWFnZVRhcmdldFNyYyA9IGltYWdlVGFyZ2V0U3JjO1xuICAgIHRoaXMubWF4VHJhY2sgPSBtYXhUcmFjaztcbiAgICB0aGlzLmZpbHRlck1pbkNGID0gZmlsdGVyTWluQ0Y7XG4gICAgdGhpcy5maWx0ZXJCZXRhID0gZmlsdGVyQmV0YTtcbiAgICB0aGlzLm1pc3NUb2xlcmFuY2UgPSBtaXNzVG9sZXJhbmNlO1xuICAgIHRoaXMud2FybXVwVG9sZXJhbmNlID0gd2FybXVwVG9sZXJhbmNlO1xuICAgIHRoaXMuc2hvd1N0YXRzID0gc2hvd1N0YXRzO1xuICAgIHRoaXMudWkgPSBuZXcgVUkoe3VpTG9hZGluZywgdWlTY2FubmluZywgdWlFcnJvcn0pO1xuICB9LFxuXG4gIHJlZ2lzdGVyQW5jaG9yOiBmdW5jdGlvbihlbCwgdGFyZ2V0SW5kZXgpIHtcbiAgICB0aGlzLmFuY2hvckVudGl0aWVzLnB1c2goe2VsOiBlbCwgdGFyZ2V0SW5kZXg6IHRhcmdldEluZGV4fSk7XG4gIH0sXG5cbiAgc3RhcnQ6IGZ1bmN0aW9uKCkge1xuICAgIHRoaXMuY29udGFpbmVyID0gdGhpcy5lbC5zY2VuZUVsLnBhcmVudE5vZGU7XG5cbiAgICBpZiAodGhpcy5zaG93U3RhdHMpIHtcbiAgICAgIHRoaXMubWFpblN0YXRzID0gbmV3IFN0YXRzKCk7XG4gICAgICB0aGlzLm1haW5TdGF0cy5zaG93UGFuZWwoIDAgKTsgLy8gMDogZnBzLCAxOiBtcywgMjogbWIsIDMrOiBjdXN0b21cbiAgICAgIHRoaXMubWFpblN0YXRzLmRvbUVsZW1lbnQuc3R5bGUuY3NzVGV4dCA9ICdwb3NpdGlvbjphYnNvbHV0ZTt0b3A6MHB4O2xlZnQ6MHB4O3otaW5kZXg6OTk5JztcbiAgICAgIHRoaXMuY29udGFpbmVyLmFwcGVuZENoaWxkKHRoaXMubWFpblN0YXRzLmRvbUVsZW1lbnQpO1xuICAgIH1cblxuICAgIHRoaXMudWkuc2hvd0xvYWRpbmcoKTtcbiAgICB0aGlzLl9zdGFydFZpZGVvKCk7XG4gIH0sXG5cbiAgc3dpdGNoVGFyZ2V0OiBmdW5jdGlvbih0YXJnZXRJbmRleCkge1xuICAgIHRoaXMuY29udHJvbGxlci5pbnRlcmVzdGVkVGFyZ2V0SW5kZXggPSB0YXJnZXRJbmRleDtcbiAgfSxcblxuICBzdG9wOiBmdW5jdGlvbigpIHtcbiAgICB0aGlzLnBhdXNlKCk7XG4gICAgY29uc3QgdHJhY2tzID0gdGhpcy52aWRlby5zcmNPYmplY3QuZ2V0VHJhY2tzKCk7XG4gICAgdHJhY2tzLmZvckVhY2goZnVuY3Rpb24odHJhY2spIHtcbiAgICAgIHRyYWNrLnN0b3AoKTtcbiAgICB9KTtcbiAgICB0aGlzLnZpZGVvLnJlbW92ZSgpO1xuICB9LFxuXG4gIHBhdXNlOiBmdW5jdGlvbihrZWVwVmlkZW89ZmFsc2UpIHtcbiAgICBpZiAoIWtlZXBWaWRlbykge1xuICAgICAgdGhpcy52aWRlby5wYXVzZSgpO1xuICAgIH1cbiAgICB0aGlzLmNvbnRyb2xsZXIuc3RvcFByb2Nlc3NWaWRlbygpO1xuICB9LFxuXG4gIHVucGF1c2U6IGZ1bmN0aW9uKCkge1xuICAgIHRoaXMudmlkZW8ucGxheSgpO1xuICAgIHRoaXMuY29udHJvbGxlci5wcm9jZXNzVmlkZW8odGhpcy52aWRlbyk7XG4gIH0sXG5cbiAgX3N0YXJ0VmlkZW86IGZ1bmN0aW9uKCkge1xuICAgIHRoaXMudmlkZW8gPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCd2aWRlbycpO1xuXG4gICAgaWYgKCF0aGlzLnZpZGVvKSB7XG4gICAgICB0aGlzLnZpZGVvID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgndmlkZW8nKTtcbiAgICAgIHRoaXMudmlkZW8uc2V0QXR0cmlidXRlKCdhdXRvcGxheScsICcnKTtcbiAgICB0aGlzLnZpZGVvLnNldEF0dHJpYnV0ZSgnbXV0ZWQnLCAnJyk7XG4gICAgdGhpcy52aWRlby5zZXRBdHRyaWJ1dGUoJ3BsYXlzaW5saW5lJywgJycpO1xuICAgIHRoaXMudmlkZW8uc3R5bGUucG9zaXRpb24gPSAnYWJzb2x1dGUnXG4gICAgdGhpcy52aWRlby5zdHlsZS50b3AgPSAnMHB4J1xuICAgIHRoaXMudmlkZW8uc3R5bGUubGVmdCA9ICcwcHgnXG4gICAgdGhpcy52aWRlby5zdHlsZS56SW5kZXggPSAnLTInXG4gICAgdGhpcy5jb250YWluZXIuYXBwZW5kQ2hpbGQodGhpcy52aWRlbyk7XG4gICAgfVxuXG4gICAgXG5cbiAgICAvLyBpZiAoIW5hdmlnYXRvci5tZWRpYURldmljZXMgfHwgIW5hdmlnYXRvci5tZWRpYURldmljZXMuZ2V0VXNlck1lZGlhKSB7XG4gICAgLy8gICAvLyBUT0RPOiBzaG93IHVuc3VwcG9ydGVkIGVycm9yXG4gICAgLy8gICB0aGlzLmVsLmVtaXQoXCJhckVycm9yXCIsIHtlcnJvcjogJ1ZJREVPX0ZBSUwnfSk7XG4gICAgLy8gICB0aGlzLnVpLnNob3dDb21wYXRpYmlsaXR5KCk7XG4gICAgLy8gICByZXR1cm47XG4gICAgLy8gfVxuXG4gICAgY29uc3QgY29uc3RyYWludCA9IHthdWRpbzogZmFsc2UsIHZpZGVvOiB7XG4gICAgICBmYWNpbmdNb2RlOiAnZW52aXJvbm1lbnQnLFxuICAgIH19O1xuXG4gICAgY29uc3Qgb25zdWNjZXNzID0gKHN0cmVhbSkgPT4ge1xuICAgICAgdGhpcy52aWRlby5hZGRFdmVudExpc3RlbmVyKCAnbG9hZGVkbWV0YWRhdGEnLCAoKSA9PiB7XG4gICAgICAgIC8vY29uc29sZS5sb2coXCJ2aWRlbyByZWFkeS4uLlwiLCB0aGlzLnZpZGVvKTtcbiAgICAgICAgdGhpcy52aWRlby5zZXRBdHRyaWJ1dGUoJ3dpZHRoJywgdGhpcy52aWRlby52aWRlb1dpZHRoKTtcbiAgICAgICAgdGhpcy52aWRlby5zZXRBdHRyaWJ1dGUoJ2hlaWdodCcsIHRoaXMudmlkZW8udmlkZW9IZWlnaHQpO1xuICAgICAgICB0aGlzLl9zdGFydEFSKCk7XG4gICAgICB9KTtcbiAgICAgIHRoaXMudmlkZW8uc3JjT2JqZWN0ID0gc3RyZWFtO1xuICAgIH1cblxuICAgIGNvbnN0IG9uZXJyb3IgPSAoZXJyKSA9PiB7XG4gICAgICBjb25zb2xlLmxvZyhcImdldFVzZXJNZWRpYSBlcnJvclwiLCBlcnIpO1xuICAgICAgdGhpcy5lbC5lbWl0KFwiYXJFcnJvclwiLCB7ZXJyb3I6ICdWSURFT19GQUlMJ30pO1xuICAgIH1cbiAgICBuYXZpZ2F0b3IubWVkaWFEZXZpY2VzICYmIG5hdmlnYXRvci5tZWRpYURldmljZXMuZ2V0VXNlck1lZGlhXG4gICAgPyBuYXZpZ2F0b3IubWVkaWFEZXZpY2VzLmdldFVzZXJNZWRpYShjb25zdHJhaW50KS50aGVuKG9uc3VjY2Vzcywgb25lcnJvcilcbiAgICA6IG5hdmlnYXRvci5nZXRVc2VyTWVkaWFcbiAgICA/IG5hdmlnYXRvci5nZXRVc2VyTWVkaWEoY29uc3RyYWludCwgb25zdWNjZXNzLCBvbmVycm9yKVxuICAgIDogY29uc29sZS5lcnJvcihuZXcgRXJyb3IoJ+W9k+WJjea1j+iniOWZqOS4jeaUr+aMgeaJk+W8gOaRhOWDj+WktCcpKTtcblxuICB9LFxuXG4gIF9zdGFydEFSOiBhc3luYyBmdW5jdGlvbigpIHtcbiAgICBjb25zdCB2aWRlbyA9IHRoaXMudmlkZW87XG4gICAgY29uc3QgY29udGFpbmVyID0gdGhpcy5jb250YWluZXI7XG5cbiAgICB0aGlzLmNvbnRyb2xsZXIgPSBuZXcgQ29udHJvbGxlcih7XG4gICAgICBpbnB1dFdpZHRoOiB2aWRlby52aWRlb1dpZHRoLFxuICAgICAgaW5wdXRIZWlnaHQ6IHZpZGVvLnZpZGVvSGVpZ2h0LFxuICAgICAgbWF4VHJhY2s6IHRoaXMubWF4VHJhY2ssIFxuICAgICAgZmlsdGVyTWluQ0Y6IHRoaXMuZmlsdGVyTWluQ0YsXG4gICAgICBmaWx0ZXJCZXRhOiB0aGlzLmZpbHRlckJldGEsXG4gICAgICBtaXNzVG9sZXJhbmNlOiB0aGlzLm1pc3NUb2xlcmFuY2UsXG4gICAgICB3YXJtdXBUb2xlcmFuY2U6IHRoaXMud2FybXVwVG9sZXJhbmNlLFxuICAgICAgb25VcGRhdGU6IChkYXRhKSA9PiB7XG5cdGlmIChkYXRhLnR5cGUgPT09ICdwcm9jZXNzRG9uZScpIHtcblx0ICBpZiAodGhpcy5tYWluU3RhdHMpIHRoaXMubWFpblN0YXRzLnVwZGF0ZSgpO1xuXHR9XG5cdGVsc2UgaWYgKGRhdGEudHlwZSA9PT0gJ3VwZGF0ZU1hdHJpeCcpIHtcblx0ICBjb25zdCB7dGFyZ2V0SW5kZXgsIHdvcmxkTWF0cml4fSA9IGRhdGE7XG5cblx0ICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMuYW5jaG9yRW50aXRpZXMubGVuZ3RoOyBpKyspIHtcblx0ICAgIGlmICh0aGlzLmFuY2hvckVudGl0aWVzW2ldLnRhcmdldEluZGV4ID09PSB0YXJnZXRJbmRleCkge1xuXHQgICAgICB0aGlzLmFuY2hvckVudGl0aWVzW2ldLmVsLnVwZGF0ZVdvcmxkTWF0cml4KHdvcmxkTWF0cml4LCApO1xuXHQgICAgICBpZiAod29ybGRNYXRyaXgpIHtcblx0XHR0aGlzLnVpLmhpZGVTY2FubmluZygpO1xuXHQgICAgICB9XG5cdCAgICB9XG5cdCAgfVxuXHR9XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICB0aGlzLl9yZXNpemUoKTtcbiAgICB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcigncmVzaXplJywgdGhpcy5fcmVzaXplLmJpbmQodGhpcykpO1xuXG4gICAgY29uc3Qge2RpbWVuc2lvbnM6IGltYWdlVGFyZ2V0RGltZW5zaW9uc30gPSBhd2FpdCB0aGlzLmNvbnRyb2xsZXIuYWRkSW1hZ2VUYXJnZXRzKHRoaXMuaW1hZ2VUYXJnZXRTcmMpO1xuXG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLmFuY2hvckVudGl0aWVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICBjb25zdCB7ZWwsIHRhcmdldEluZGV4fSA9IHRoaXMuYW5jaG9yRW50aXRpZXNbaV07XG4gICAgICBpZiAodGFyZ2V0SW5kZXggPCBpbWFnZVRhcmdldERpbWVuc2lvbnMubGVuZ3RoKSB7XG4gICAgICAgIGVsLnNldHVwTWFya2VyKGltYWdlVGFyZ2V0RGltZW5zaW9uc1t0YXJnZXRJbmRleF0pO1xuICAgICAgfVxuICAgIH1cblxuICAgIGF3YWl0IHRoaXMuY29udHJvbGxlci5kdW1teVJ1bih0aGlzLnZpZGVvKTtcbiAgICB0aGlzLmVsLmVtaXQoXCJhclJlYWR5XCIpO1xuICAgIHRoaXMudWkuaGlkZUxvYWRpbmcoKTtcbiAgICB0aGlzLnVpLnNob3dTY2FubmluZygpO1xuXG4gICAgdGhpcy5jb250cm9sbGVyLnByb2Nlc3NWaWRlbyh0aGlzLnZpZGVvKTtcbiAgfSxcblxuICBfcmVzaXplOiBmdW5jdGlvbigpIHtcbiAgICBjb25zdCB2aWRlbyA9IHRoaXMudmlkZW87XG4gICAgY29uc3QgY29udGFpbmVyID0gdGhpcy5jb250YWluZXI7XG5cbiAgICBsZXQgdncsIHZoOyAvLyBkaXNwbGF5IGNzcyB3aWR0aCwgaGVpZ2h0XG4gICAgY29uc3QgdmlkZW9SYXRpbyA9IHZpZGVvLnZpZGVvV2lkdGggLyB2aWRlby52aWRlb0hlaWdodDtcbiAgICBjb25zdCBjb250YWluZXJSYXRpbyA9IGNvbnRhaW5lci5jbGllbnRXaWR0aCAvIGNvbnRhaW5lci5jbGllbnRIZWlnaHQ7XG4gICAgaWYgKHZpZGVvUmF0aW8gPiBjb250YWluZXJSYXRpbykge1xuICAgICAgdmggPSBjb250YWluZXIuY2xpZW50SGVpZ2h0O1xuICAgICAgdncgPSB2aCAqIHZpZGVvUmF0aW87XG4gICAgfSBlbHNlIHtcbiAgICAgIHZ3ID0gY29udGFpbmVyLmNsaWVudFdpZHRoO1xuICAgICAgdmggPSB2dyAvIHZpZGVvUmF0aW87XG4gICAgfVxuXG4gICAgY29uc3QgcHJvaiA9IHRoaXMuY29udHJvbGxlci5nZXRQcm9qZWN0aW9uTWF0cml4KCk7XG4gICAgY29uc3QgZm92ID0gMiAqIE1hdGguYXRhbigxL3Byb2pbNV0gLyB2aCAqIGNvbnRhaW5lci5jbGllbnRIZWlnaHQgKSAqIDE4MCAvIE1hdGguUEk7IC8vIHZlcnRpY2FsIGZvdlxuICAgIGNvbnN0IG5lYXIgPSBwcm9qWzE0XSAvIChwcm9qWzEwXSAtIDEuMCk7XG4gICAgY29uc3QgZmFyID0gcHJvalsxNF0gLyAocHJvalsxMF0gKyAxLjApO1xuICAgIGNvbnN0IHJhdGlvID0gcHJvals1XSAvIHByb2pbMF07IC8vIChyLWwpIC8gKHQtYilcbiAgICAvL2NvbnNvbGUubG9nKFwibG9hZGVkIHByb2o6IFwiLCBwcm9qLCBcIi4gZm92OiBcIiwgZm92LCBcIi4gbmVhcjogXCIsIG5lYXIsIFwiLiBmYXI6IFwiLCBmYXIsIFwiLiByYXRpbzogXCIsIHJhdGlvKTtcbiAgICBjb25zdCBuZXdBc3BlY3QgPSBjb250YWluZXIuY2xpZW50V2lkdGggLyBjb250YWluZXIuY2xpZW50SGVpZ2h0O1xuICAgIGNvbnN0IGNhbWVyYUVsZSA9IGNvbnRhaW5lci5nZXRFbGVtZW50c0J5VGFnTmFtZShcImEtY2FtZXJhXCIpWzBdO1xuICAgIGNvbnN0IGNhbWVyYSA9IGNhbWVyYUVsZS5nZXRPYmplY3QzRCgnY2FtZXJhJyk7XG4gICAgY2FtZXJhLmZvdiA9IGZvdjtcbiAgICBjYW1lcmEuYXNwZWN0ID0gbmV3QXNwZWN0O1xuICAgIGNhbWVyYS5uZWFyID0gbmVhcjtcbiAgICBjYW1lcmEuZmFyID0gZmFyO1xuICAgIGNhbWVyYS51cGRhdGVQcm9qZWN0aW9uTWF0cml4KCk7XG4gICAgLy9jb25zdCBuZXdDYW0gPSBuZXcgQUZSQU1FLlRIUkVFLlBlcnNwZWN0aXZlQ2FtZXJhKGZvdiwgbmV3UmF0aW8sIG5lYXIsIGZhcik7XG4gICAgLy9jYW1lcmEuZ2V0T2JqZWN0M0QoJ2NhbWVyYScpLnByb2plY3Rpb25NYXRyaXggPSBuZXdDYW0ucHJvamVjdGlvbk1hdHJpeDtcblxuICAgIHRoaXMudmlkZW8uc3R5bGUudG9wID0gKC0odmggLSBjb250YWluZXIuY2xpZW50SGVpZ2h0KSAvIDIpICsgXCJweFwiO1xuICAgIHRoaXMudmlkZW8uc3R5bGUubGVmdCA9ICgtKHZ3IC0gY29udGFpbmVyLmNsaWVudFdpZHRoKSAvIDIpICsgXCJweFwiO1xuICAgIHRoaXMudmlkZW8uc3R5bGUud2lkdGggPSB2dyArIFwicHhcIjtcbiAgICB0aGlzLnZpZGVvLnN0eWxlLmhlaWdodCA9IHZoICsgXCJweFwiO1xuICB9XG59KTtcblxuQUZSQU1FLnJlZ2lzdGVyQ29tcG9uZW50KCdtaW5kYXItaW1hZ2UnLCB7XG4gIGRlcGVuZGVuY2llczogWydtaW5kYXItaW1hZ2Utc3lzdGVtJ10sXG5cbiAgc2NoZW1hOiB7XG4gICAgaW1hZ2VUYXJnZXRTcmM6IHt0eXBlOiAnc3RyaW5nJ30sXG4gICAgbWF4VHJhY2s6IHt0eXBlOiAnaW50JywgZGVmYXVsdDogMX0sXG4gICAgZmlsdGVyTWluQ0Y6IHt0eXBlOiAnbnVtYmVyJywgZGVmYXVsdDogLTF9LFxuICAgIGZpbHRlckJldGE6IHt0eXBlOiAnbnVtYmVyJywgZGVmYXVsdDogLTF9LFxuICAgIG1pc3NUb2xlcmFuY2U6IHt0eXBlOiAnaW50JywgZGVmYXVsdDogLTF9LFxuICAgIHdhcm11cFRvbGVyYW5jZToge3R5cGU6ICdpbnQnLCBkZWZhdWx0OiAtMX0sXG4gICAgc2hvd1N0YXRzOiB7dHlwZTogJ2Jvb2xlYW4nLCBkZWZhdWx0OiBmYWxzZX0sXG4gICAgYXV0b1N0YXJ0OiB7dHlwZTogJ2Jvb2xlYW4nLCBkZWZhdWx0OiB0cnVlfSxcbiAgICB1aUxvYWRpbmc6IHt0eXBlOiAnc3RyaW5nJywgZGVmYXVsdDogJ3llcyd9LFxuICAgIHVpU2Nhbm5pbmc6IHt0eXBlOiAnc3RyaW5nJywgZGVmYXVsdDogJ3llcyd9LFxuICAgIHVpRXJyb3I6IHt0eXBlOiAnc3RyaW5nJywgZGVmYXVsdDogJ3llcyd9LFxuICB9LFxuXG4gIGluaXQ6IGZ1bmN0aW9uKCkge1xuICAgIGNvbnN0IGFyU3lzdGVtID0gdGhpcy5lbC5zY2VuZUVsLnN5c3RlbXNbJ21pbmRhci1pbWFnZS1zeXN0ZW0nXTtcblxuICAgIGFyU3lzdGVtLnNldHVwKHtcbiAgICAgIGltYWdlVGFyZ2V0U3JjOiB0aGlzLmRhdGEuaW1hZ2VUYXJnZXRTcmMsIFxuICAgICAgbWF4VHJhY2s6IHRoaXMuZGF0YS5tYXhUcmFjayxcbiAgICAgIGZpbHRlck1pbkNGOiB0aGlzLmRhdGEuZmlsdGVyTWluQ0YgPT09IC0xPyBudWxsOiB0aGlzLmRhdGEuZmlsdGVyTWluQ0YsXG4gICAgICBmaWx0ZXJCZXRhOiB0aGlzLmRhdGEuZmlsdGVyQmV0YSA9PT0gLTE/IG51bGw6IHRoaXMuZGF0YS5maWx0ZXJCZXRhLFxuICAgICAgbWlzc1RvbGVyYW5jZTogdGhpcy5kYXRhLm1pc3NUb2xlcmFuY2UgPT09IC0xPyBudWxsOiB0aGlzLmRhdGEubWlzc1RvbGVyYW5jZSxcbiAgICAgIHdhcm11cFRvbGVyYW5jZTogdGhpcy5kYXRhLndhcm11cFRvbGVyYW5jZSA9PT0gLTE/IG51bGw6IHRoaXMuZGF0YS53YXJtdXBUb2xlcmFuY2UsXG4gICAgICBzaG93U3RhdHM6IHRoaXMuZGF0YS5zaG93U3RhdHMsXG4gICAgICB1aUxvYWRpbmc6IHRoaXMuZGF0YS51aUxvYWRpbmcsXG4gICAgICB1aVNjYW5uaW5nOiB0aGlzLmRhdGEudWlTY2FubmluZyxcbiAgICAgIHVpRXJyb3I6IHRoaXMuZGF0YS51aUVycm9yLFxuICAgIH0pO1xuICAgIGlmICh0aGlzLmRhdGEuYXV0b1N0YXJ0KSB7XG4gICAgICB0aGlzLmVsLnNjZW5lRWwuYWRkRXZlbnRMaXN0ZW5lcigncmVuZGVyc3RhcnQnLCAoKSA9PiB7XG4gICAgICAgIGFyU3lzdGVtLnN0YXJ0KCk7XG4gICAgICB9KTtcbiAgICB9XG4gIH1cbn0pO1xuXG5BRlJBTUUucmVnaXN0ZXJDb21wb25lbnQoJ21pbmRhci1pbWFnZS10YXJnZXQnLCB7XG4gIGRlcGVuZGVuY2llczogWydtaW5kYXItaW1hZ2Utc3lzdGVtJ10sXG5cbiAgc2NoZW1hOiB7XG4gICAgdGFyZ2V0SW5kZXg6IHt0eXBlOiAnbnVtYmVyJ30sXG4gIH0sXG5cbiAgcG9zdE1hdHJpeDogbnVsbCwgLy8gcmVzY2FsZSB0aGUgYW5jaG9yIHRvIG1ha2Ugd2lkdGggb2YgMSB1bml0ID0gcGh5c2ljYWwgd2lkdGggb2YgY2FyZFxuXG4gIGluaXQ6IGZ1bmN0aW9uKCkge1xuICAgIGNvbnN0IGFyU3lzdGVtID0gdGhpcy5lbC5zY2VuZUVsLnN5c3RlbXNbJ21pbmRhci1pbWFnZS1zeXN0ZW0nXTtcbiAgICBhclN5c3RlbS5yZWdpc3RlckFuY2hvcih0aGlzLCB0aGlzLmRhdGEudGFyZ2V0SW5kZXgpO1xuXG4gICAgY29uc3Qgcm9vdCA9IHRoaXMuZWwub2JqZWN0M0Q7XG4gICAgcm9vdC52aXNpYmxlID0gZmFsc2U7XG4gICAgcm9vdC5tYXRyaXhBdXRvVXBkYXRlID0gZmFsc2U7XG4gIH0sXG5cbiAgc2V0dXBNYXJrZXIoW21hcmtlcldpZHRoLCBtYXJrZXJIZWlnaHRdKSB7XG4gICAgY29uc3QgcG9zaXRpb24gPSBuZXcgQUZSQU1FLlRIUkVFLlZlY3RvcjMoKTtcbiAgICBjb25zdCBxdWF0ZXJuaW9uID0gbmV3IEFGUkFNRS5USFJFRS5RdWF0ZXJuaW9uKCk7XG4gICAgY29uc3Qgc2NhbGUgPSBuZXcgQUZSQU1FLlRIUkVFLlZlY3RvcjMoKTtcbiAgICBwb3NpdGlvbi54ID0gbWFya2VyV2lkdGggLyAyO1xuICAgIHBvc2l0aW9uLnkgPSBtYXJrZXJXaWR0aCAvIDIgKyAobWFya2VySGVpZ2h0IC0gbWFya2VyV2lkdGgpIC8gMjtcbiAgICBzY2FsZS54ID0gbWFya2VyV2lkdGg7XG4gICAgc2NhbGUueSA9IG1hcmtlcldpZHRoO1xuICAgIHNjYWxlLnogPSBtYXJrZXJXaWR0aDtcbiAgICB0aGlzLnBvc3RNYXRyaXggPSBuZXcgQUZSQU1FLlRIUkVFLk1hdHJpeDQoKTtcbiAgICB0aGlzLnBvc3RNYXRyaXguY29tcG9zZShwb3NpdGlvbiwgcXVhdGVybmlvbiwgc2NhbGUpO1xuICB9LFxuXG4gIHVwZGF0ZVdvcmxkTWF0cml4KHdvcmxkTWF0cml4KSB7XG4gICAgaWYgKCF0aGlzLmVsLm9iamVjdDNELnZpc2libGUgJiYgd29ybGRNYXRyaXggIT09IG51bGwpIHtcbiAgICAgIHRoaXMuZWwuZW1pdChcInRhcmdldEZvdW5kXCIpO1xuICAgIH0gZWxzZSBpZiAodGhpcy5lbC5vYmplY3QzRC52aXNpYmxlICYmIHdvcmxkTWF0cml4ID09PSBudWxsKSB7XG4gICAgICB0aGlzLmVsLmVtaXQoXCJ0YXJnZXRMb3N0XCIpO1xuICAgIH1cblxuICAgIHRoaXMuZWwub2JqZWN0M0QudmlzaWJsZSA9IHdvcmxkTWF0cml4ICE9PSBudWxsO1xuICAgIGlmICh3b3JsZE1hdHJpeCA9PT0gbnVsbCkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICB2YXIgbSA9IG5ldyBBRlJBTUUuVEhSRUUuTWF0cml4NCgpO1xuICAgIG0uZWxlbWVudHMgPSB3b3JsZE1hdHJpeDtcbiAgICBtLm11bHRpcGx5KHRoaXMucG9zdE1hdHJpeCk7XG4gICAgdGhpcy5lbC5vYmplY3QzRC5tYXRyaXggPSBtO1xuICB9XG59KTtcbiJdLCJzb3VyY2VSb290IjoiIn0=