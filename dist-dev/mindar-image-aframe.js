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
    console.log('start video')
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

    this.video.addEventListener( 'loadedmetadata', () => {
      console.log('loadedmetadata', this.video.videoWidth, this.video.videoHeight)
      console.log('width', this.video.videoWidth)
      console.log('height', this.video.videoHeight)
      //console.log("video ready...", this.video);
      this.video.setAttribute('width', this.video.videoWidth);
      this.video.setAttribute('height', this.video.videoHeight);
      this._startAR();
    });
    

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
      console.log('onsuccess');
      'srcObject' in this.video ? ((this.video.src = ''), (this.video.srcObject = stream)) : (this.video.src = URL.createObjectURL(stream));
      this.video.play();

      // this.video.setAttribute('width', 640);
      // this.video.setAttribute('height', 480);
      // this._startAR();
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIndlYnBhY2s6Ly9taW5kLWFyLy4vc3JjL2ltYWdlLXRhcmdldC9hZnJhbWUuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7QUFBQSxPQUFPLGVBQWU7O0FBRXRCO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQSxHQUFHOztBQUVIO0FBQ0EsR0FBRzs7QUFFSCxtQkFBbUIsNkhBQTZIO0FBQ2hKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0Esc0JBQXNCLCtCQUErQjtBQUNyRCxHQUFHOztBQUVIO0FBQ0EsOEJBQThCLGlDQUFpQztBQUMvRCxHQUFHOztBQUVIO0FBQ0E7O0FBRUE7QUFDQTtBQUNBLG9DQUFvQztBQUNwQyxtRUFBbUUsUUFBUSxTQUFTO0FBQ3BGO0FBQ0E7O0FBRUE7QUFDQTtBQUNBLEdBQUc7O0FBRUg7QUFDQTtBQUNBLEdBQUc7O0FBRUg7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLEtBQUs7QUFDTDtBQUNBLEdBQUc7O0FBRUg7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLEdBQUc7O0FBRUg7QUFDQTtBQUNBO0FBQ0EsR0FBRzs7QUFFSDtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsS0FBSzs7O0FBR0w7QUFDQTtBQUNBLGtDQUFrQyxvQkFBb0I7QUFDdEQ7QUFDQTtBQUNBOztBQUVBLHdCQUF3QjtBQUN4QjtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7O0FBRUE7QUFDQSwrQkFBK0Isb0JBQW9CO0FBQ25EO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBLEdBQUc7O0FBRUg7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxVQUFVLHlCQUF5Qjs7QUFFbkMsa0JBQWtCLGdDQUFnQztBQUNsRDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxLQUFLOztBQUVMOztBQUVBO0FBQ0E7QUFDQTs7QUFFQSxXQUFXLGtDQUFrQzs7QUFFN0M7QUFDQSxtQkFBbUIsZ0NBQWdDO0FBQ25ELGFBQWEsZ0JBQWdCO0FBQzdCO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7OztBQUdBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQSxHQUFHOztBQUVIO0FBQ0E7QUFDQTs7QUFFQSxlQUFlO0FBQ2Y7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLEtBQUs7QUFDTDtBQUNBO0FBQ0E7O0FBRUE7QUFDQSx3RkFBd0Y7QUFDeEY7QUFDQTtBQUNBLG9DQUFvQztBQUNwQztBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxDQUFDOztBQUVEO0FBQ0E7O0FBRUE7QUFDQSxxQkFBcUIsZUFBZTtBQUNwQyxlQUFlLHdCQUF3QjtBQUN2QyxrQkFBa0IsNEJBQTRCO0FBQzlDLGlCQUFpQiw0QkFBNEI7QUFDN0Msb0JBQW9CLHlCQUF5QjtBQUM3QyxzQkFBc0IseUJBQXlCO0FBQy9DLGdCQUFnQixnQ0FBZ0M7QUFDaEQsZ0JBQWdCLCtCQUErQjtBQUMvQyxnQkFBZ0IsK0JBQStCO0FBQy9DLGlCQUFpQiwrQkFBK0I7QUFDaEQsY0FBYywrQkFBK0I7QUFDN0MsR0FBRzs7QUFFSDtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxLQUFLO0FBQ0w7QUFDQTtBQUNBO0FBQ0EsT0FBTztBQUNQO0FBQ0E7QUFDQSxDQUFDOztBQUVEO0FBQ0E7O0FBRUE7QUFDQSxrQkFBa0IsZUFBZTtBQUNqQyxHQUFHOztBQUVIOztBQUVBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQSxHQUFHOztBQUVIO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxHQUFHOztBQUVIO0FBQ0E7QUFDQTtBQUNBLEtBQUs7QUFDTDtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLENBQUMiLCJmaWxlIjoibWluZGFyLWltYWdlLWFmcmFtZS5qcyIsInNvdXJjZXNDb250ZW50IjpbImNvbnN0IHtDb250cm9sbGVyLCBVSX0gPSB3aW5kb3cuTUlOREFSLklNQUdFO1xuXG5BRlJBTUUucmVnaXN0ZXJTeXN0ZW0oJ21pbmRhci1pbWFnZS1zeXN0ZW0nLCB7XG4gIGNvbnRhaW5lcjogbnVsbCxcbiAgdmlkZW86IG51bGwsXG4gIHByb2Nlc3NpbmdJbWFnZTogZmFsc2UsXG5cbiAgaW5pdDogZnVuY3Rpb24oKSB7XG4gICAgdGhpcy5hbmNob3JFbnRpdGllcyA9IFtdO1xuICB9LFxuXG4gIHRpY2s6IGZ1bmN0aW9uKCkge1xuICB9LFxuXG4gIHNldHVwOiBmdW5jdGlvbih7aW1hZ2VUYXJnZXRTcmMsIG1heFRyYWNrLCBzaG93U3RhdHMsIHVpTG9hZGluZywgdWlTY2FubmluZywgdWlFcnJvciwgbWlzc1RvbGVyYW5jZSwgd2FybXVwVG9sZXJhbmNlLCBmaWx0ZXJNaW5DRiwgZmlsdGVyQmV0YX0pIHtcbiAgICB0aGlzLmltYWdlVGFyZ2V0U3JjID0gaW1hZ2VUYXJnZXRTcmM7XG4gICAgdGhpcy5tYXhUcmFjayA9IG1heFRyYWNrO1xuICAgIHRoaXMuZmlsdGVyTWluQ0YgPSBmaWx0ZXJNaW5DRjtcbiAgICB0aGlzLmZpbHRlckJldGEgPSBmaWx0ZXJCZXRhO1xuICAgIHRoaXMubWlzc1RvbGVyYW5jZSA9IG1pc3NUb2xlcmFuY2U7XG4gICAgdGhpcy53YXJtdXBUb2xlcmFuY2UgPSB3YXJtdXBUb2xlcmFuY2U7XG4gICAgdGhpcy5zaG93U3RhdHMgPSBzaG93U3RhdHM7XG4gICAgdGhpcy51aSA9IG5ldyBVSSh7dWlMb2FkaW5nLCB1aVNjYW5uaW5nLCB1aUVycm9yfSk7XG4gIH0sXG5cbiAgcmVnaXN0ZXJBbmNob3I6IGZ1bmN0aW9uKGVsLCB0YXJnZXRJbmRleCkge1xuICAgIHRoaXMuYW5jaG9yRW50aXRpZXMucHVzaCh7ZWw6IGVsLCB0YXJnZXRJbmRleDogdGFyZ2V0SW5kZXh9KTtcbiAgfSxcblxuICBzdGFydDogZnVuY3Rpb24oKSB7XG4gICAgdGhpcy5jb250YWluZXIgPSB0aGlzLmVsLnNjZW5lRWwucGFyZW50Tm9kZTtcblxuICAgIGlmICh0aGlzLnNob3dTdGF0cykge1xuICAgICAgdGhpcy5tYWluU3RhdHMgPSBuZXcgU3RhdHMoKTtcbiAgICAgIHRoaXMubWFpblN0YXRzLnNob3dQYW5lbCggMCApOyAvLyAwOiBmcHMsIDE6IG1zLCAyOiBtYiwgMys6IGN1c3RvbVxuICAgICAgdGhpcy5tYWluU3RhdHMuZG9tRWxlbWVudC5zdHlsZS5jc3NUZXh0ID0gJ3Bvc2l0aW9uOmFic29sdXRlO3RvcDowcHg7bGVmdDowcHg7ei1pbmRleDo5OTknO1xuICAgICAgdGhpcy5jb250YWluZXIuYXBwZW5kQ2hpbGQodGhpcy5tYWluU3RhdHMuZG9tRWxlbWVudCk7XG4gICAgfVxuXG4gICAgdGhpcy51aS5zaG93TG9hZGluZygpO1xuICAgIHRoaXMuX3N0YXJ0VmlkZW8oKTtcbiAgfSxcblxuICBzd2l0Y2hUYXJnZXQ6IGZ1bmN0aW9uKHRhcmdldEluZGV4KSB7XG4gICAgdGhpcy5jb250cm9sbGVyLmludGVyZXN0ZWRUYXJnZXRJbmRleCA9IHRhcmdldEluZGV4O1xuICB9LFxuXG4gIHN0b3A6IGZ1bmN0aW9uKCkge1xuICAgIHRoaXMucGF1c2UoKTtcbiAgICBjb25zdCB0cmFja3MgPSB0aGlzLnZpZGVvLnNyY09iamVjdC5nZXRUcmFja3MoKTtcbiAgICB0cmFja3MuZm9yRWFjaChmdW5jdGlvbih0cmFjaykge1xuICAgICAgdHJhY2suc3RvcCgpO1xuICAgIH0pO1xuICAgIHRoaXMudmlkZW8ucmVtb3ZlKCk7XG4gIH0sXG5cbiAgcGF1c2U6IGZ1bmN0aW9uKGtlZXBWaWRlbz1mYWxzZSkge1xuICAgIGlmICgha2VlcFZpZGVvKSB7XG4gICAgICB0aGlzLnZpZGVvLnBhdXNlKCk7XG4gICAgfVxuICAgIHRoaXMuY29udHJvbGxlci5zdG9wUHJvY2Vzc1ZpZGVvKCk7XG4gIH0sXG5cbiAgdW5wYXVzZTogZnVuY3Rpb24oKSB7XG4gICAgdGhpcy52aWRlby5wbGF5KCk7XG4gICAgdGhpcy5jb250cm9sbGVyLnByb2Nlc3NWaWRlbyh0aGlzLnZpZGVvKTtcbiAgfSxcblxuICBfc3RhcnRWaWRlbzogZnVuY3Rpb24oKSB7XG4gICAgY29uc29sZS5sb2coJ3N0YXJ0IHZpZGVvJylcbiAgICB0aGlzLnZpZGVvID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcigndmlkZW8nKTtcblxuICAgIGlmICghdGhpcy52aWRlbykge1xuICAgICAgdGhpcy52aWRlbyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3ZpZGVvJyk7XG4gICAgICB0aGlzLnZpZGVvLnNldEF0dHJpYnV0ZSgnYXV0b3BsYXknLCAnJyk7XG4gICAgdGhpcy52aWRlby5zZXRBdHRyaWJ1dGUoJ211dGVkJywgJycpO1xuICAgIHRoaXMudmlkZW8uc2V0QXR0cmlidXRlKCdwbGF5c2lubGluZScsICcnKTtcbiAgICB0aGlzLnZpZGVvLnN0eWxlLnBvc2l0aW9uID0gJ2Fic29sdXRlJ1xuICAgIHRoaXMudmlkZW8uc3R5bGUudG9wID0gJzBweCdcbiAgICB0aGlzLnZpZGVvLnN0eWxlLmxlZnQgPSAnMHB4J1xuICAgIHRoaXMudmlkZW8uc3R5bGUuekluZGV4ID0gJy0yJ1xuICAgIHRoaXMuY29udGFpbmVyLmFwcGVuZENoaWxkKHRoaXMudmlkZW8pO1xuICAgIH1cblxuICAgIHRoaXMudmlkZW8uYWRkRXZlbnRMaXN0ZW5lciggJ2xvYWRlZG1ldGFkYXRhJywgKCkgPT4ge1xuICAgICAgY29uc29sZS5sb2coJ2xvYWRlZG1ldGFkYXRhJywgdGhpcy52aWRlby52aWRlb1dpZHRoLCB0aGlzLnZpZGVvLnZpZGVvSGVpZ2h0KVxuICAgICAgY29uc29sZS5sb2coJ3dpZHRoJywgdGhpcy52aWRlby52aWRlb1dpZHRoKVxuICAgICAgY29uc29sZS5sb2coJ2hlaWdodCcsIHRoaXMudmlkZW8udmlkZW9IZWlnaHQpXG4gICAgICAvL2NvbnNvbGUubG9nKFwidmlkZW8gcmVhZHkuLi5cIiwgdGhpcy52aWRlbyk7XG4gICAgICB0aGlzLnZpZGVvLnNldEF0dHJpYnV0ZSgnd2lkdGgnLCB0aGlzLnZpZGVvLnZpZGVvV2lkdGgpO1xuICAgICAgdGhpcy52aWRlby5zZXRBdHRyaWJ1dGUoJ2hlaWdodCcsIHRoaXMudmlkZW8udmlkZW9IZWlnaHQpO1xuICAgICAgdGhpcy5fc3RhcnRBUigpO1xuICAgIH0pO1xuICAgIFxuXG4gICAgLy8gaWYgKCFuYXZpZ2F0b3IubWVkaWFEZXZpY2VzIHx8ICFuYXZpZ2F0b3IubWVkaWFEZXZpY2VzLmdldFVzZXJNZWRpYSkge1xuICAgIC8vICAgLy8gVE9ETzogc2hvdyB1bnN1cHBvcnRlZCBlcnJvclxuICAgIC8vICAgdGhpcy5lbC5lbWl0KFwiYXJFcnJvclwiLCB7ZXJyb3I6ICdWSURFT19GQUlMJ30pO1xuICAgIC8vICAgdGhpcy51aS5zaG93Q29tcGF0aWJpbGl0eSgpO1xuICAgIC8vICAgcmV0dXJuO1xuICAgIC8vIH1cblxuICAgIGNvbnN0IGNvbnN0cmFpbnQgPSB7YXVkaW86IGZhbHNlLCB2aWRlbzoge1xuICAgICAgZmFjaW5nTW9kZTogJ2Vudmlyb25tZW50JyxcbiAgICB9fTtcblxuICAgIGNvbnN0IG9uc3VjY2VzcyA9IChzdHJlYW0pID0+IHtcbiAgICAgIGNvbnNvbGUubG9nKCdvbnN1Y2Nlc3MnKTtcbiAgICAgICdzcmNPYmplY3QnIGluIHRoaXMudmlkZW8gPyAoKHRoaXMudmlkZW8uc3JjID0gJycpLCAodGhpcy52aWRlby5zcmNPYmplY3QgPSBzdHJlYW0pKSA6ICh0aGlzLnZpZGVvLnNyYyA9IFVSTC5jcmVhdGVPYmplY3RVUkwoc3RyZWFtKSk7XG4gICAgICB0aGlzLnZpZGVvLnBsYXkoKTtcblxuICAgICAgLy8gdGhpcy52aWRlby5zZXRBdHRyaWJ1dGUoJ3dpZHRoJywgNjQwKTtcbiAgICAgIC8vIHRoaXMudmlkZW8uc2V0QXR0cmlidXRlKCdoZWlnaHQnLCA0ODApO1xuICAgICAgLy8gdGhpcy5fc3RhcnRBUigpO1xuICAgIH1cblxuICAgIGNvbnN0IG9uZXJyb3IgPSAoZXJyKSA9PiB7XG4gICAgICBjb25zb2xlLmxvZygnb25lcnJvcicpXG5cbiAgICAgIGNvbnNvbGUubG9nKFwiZ2V0VXNlck1lZGlhIGVycm9yXCIsIGVycik7XG4gICAgICB0aGlzLmVsLmVtaXQoXCJhckVycm9yXCIsIHtlcnJvcjogJ1ZJREVPX0ZBSUwnfSk7XG4gICAgfVxuICAgIGNvbnNvbGUubG9nKCdnZXRVc2VyTWVkaWEnKVxuICAgIG5hdmlnYXRvci5tZWRpYURldmljZXMgJiYgbmF2aWdhdG9yLm1lZGlhRGV2aWNlcy5nZXRVc2VyTWVkaWFcbiAgICA/IG5hdmlnYXRvci5tZWRpYURldmljZXMuZ2V0VXNlck1lZGlhKGNvbnN0cmFpbnQpLnRoZW4ob25zdWNjZXNzLCBvbmVycm9yKVxuICAgIDogbmF2aWdhdG9yLmdldFVzZXJNZWRpYVxuICAgID8gbmF2aWdhdG9yLmdldFVzZXJNZWRpYShjb25zdHJhaW50LCBvbnN1Y2Nlc3MsIG9uZXJyb3IpXG4gICAgOiBjb25zb2xlLmVycm9yKG5ldyBFcnJvcign5b2T5YmN5rWP6KeI5Zmo5LiN5pSv5oyB5omT5byA5pGE5YOP5aS0JykpO1xuXG4gIH0sXG5cbiAgX3N0YXJ0QVI6IGFzeW5jIGZ1bmN0aW9uKCkge1xuICAgIGNvbnNvbGUubG9nKCdzdGFydEFSJylcbiAgICBjb25zdCB2aWRlbyA9IHRoaXMudmlkZW87XG4gICAgY29uc3QgY29udGFpbmVyID0gdGhpcy5jb250YWluZXI7XG5cbiAgICB0aGlzLmNvbnRyb2xsZXIgPSBuZXcgQ29udHJvbGxlcih7XG4gICAgICBpbnB1dFdpZHRoOiB2aWRlby52aWRlb1dpZHRoLFxuICAgICAgaW5wdXRIZWlnaHQ6IHZpZGVvLnZpZGVvSGVpZ2h0LFxuICAgICAgbWF4VHJhY2s6IHRoaXMubWF4VHJhY2ssIFxuICAgICAgZmlsdGVyTWluQ0Y6IHRoaXMuZmlsdGVyTWluQ0YsXG4gICAgICBmaWx0ZXJCZXRhOiB0aGlzLmZpbHRlckJldGEsXG4gICAgICBtaXNzVG9sZXJhbmNlOiB0aGlzLm1pc3NUb2xlcmFuY2UsXG4gICAgICB3YXJtdXBUb2xlcmFuY2U6IHRoaXMud2FybXVwVG9sZXJhbmNlLFxuICAgICAgb25VcGRhdGU6IChkYXRhKSA9PiB7XG5cdGlmIChkYXRhLnR5cGUgPT09ICdwcm9jZXNzRG9uZScpIHtcblx0ICBpZiAodGhpcy5tYWluU3RhdHMpIHRoaXMubWFpblN0YXRzLnVwZGF0ZSgpO1xuXHR9XG5cdGVsc2UgaWYgKGRhdGEudHlwZSA9PT0gJ3VwZGF0ZU1hdHJpeCcpIHtcblx0ICBjb25zdCB7dGFyZ2V0SW5kZXgsIHdvcmxkTWF0cml4fSA9IGRhdGE7XG5cblx0ICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMuYW5jaG9yRW50aXRpZXMubGVuZ3RoOyBpKyspIHtcblx0ICAgIGlmICh0aGlzLmFuY2hvckVudGl0aWVzW2ldLnRhcmdldEluZGV4ID09PSB0YXJnZXRJbmRleCkge1xuXHQgICAgICB0aGlzLmFuY2hvckVudGl0aWVzW2ldLmVsLnVwZGF0ZVdvcmxkTWF0cml4KHdvcmxkTWF0cml4LCApO1xuXHQgICAgICBpZiAod29ybGRNYXRyaXgpIHtcblx0XHR0aGlzLnVpLmhpZGVTY2FubmluZygpO1xuXHQgICAgICB9XG5cdCAgICB9XG5cdCAgfVxuXHR9XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICBjb25zb2xlLmxvZygnY29udHJvbGxlciBpbml0JylcblxuICAgIHRoaXMuX3Jlc2l6ZSgpO1xuICAgIGNvbnNvbGUubG9nKCdyZXNpemVkJylcbiAgICB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcigncmVzaXplJywgdGhpcy5fcmVzaXplLmJpbmQodGhpcykpO1xuXG4gICAgY29uc3Qge2RpbWVuc2lvbnM6IGltYWdlVGFyZ2V0RGltZW5zaW9uc30gPSBhd2FpdCB0aGlzLmNvbnRyb2xsZXIuYWRkSW1hZ2VUYXJnZXRzKHRoaXMuaW1hZ2VUYXJnZXRTcmMpO1xuXG4gICAgY29uc29sZS5sb2coJ2FkZCB0YXJnZXRzJylcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMuYW5jaG9yRW50aXRpZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgIGNvbnN0IHtlbCwgdGFyZ2V0SW5kZXh9ID0gdGhpcy5hbmNob3JFbnRpdGllc1tpXTtcbiAgICAgIGlmICh0YXJnZXRJbmRleCA8IGltYWdlVGFyZ2V0RGltZW5zaW9ucy5sZW5ndGgpIHtcbiAgICAgICAgZWwuc2V0dXBNYXJrZXIoaW1hZ2VUYXJnZXREaW1lbnNpb25zW3RhcmdldEluZGV4XSk7XG4gICAgICB9XG4gICAgfVxuICAgIGNvbnNvbGUubG9nKCdzZXR1cE1hcmtlcicpXG5cblxuICAgIGF3YWl0IHRoaXMuY29udHJvbGxlci5kdW1teVJ1bih0aGlzLnZpZGVvKTtcbiAgICBjb25zb2xlLmxvZygnZHVtbXlSdW4nKVxuICAgIHRoaXMuZWwuZW1pdChcImFyUmVhZHlcIik7XG4gICAgdGhpcy51aS5oaWRlTG9hZGluZygpO1xuICAgIHRoaXMudWkuc2hvd1NjYW5uaW5nKCk7XG5cbiAgICB0aGlzLmNvbnRyb2xsZXIucHJvY2Vzc1ZpZGVvKHRoaXMudmlkZW8pO1xuICB9LFxuXG4gIF9yZXNpemU6IGZ1bmN0aW9uKCkge1xuICAgIGNvbnN0IHZpZGVvID0gdGhpcy52aWRlbztcbiAgICBjb25zdCBjb250YWluZXIgPSB0aGlzLmNvbnRhaW5lcjtcblxuICAgIGxldCB2dywgdmg7IC8vIGRpc3BsYXkgY3NzIHdpZHRoLCBoZWlnaHRcbiAgICBjb25zdCB2aWRlb1JhdGlvID0gdmlkZW8udmlkZW9XaWR0aCAvIHZpZGVvLnZpZGVvSGVpZ2h0O1xuICAgIGNvbnN0IGNvbnRhaW5lclJhdGlvID0gY29udGFpbmVyLmNsaWVudFdpZHRoIC8gY29udGFpbmVyLmNsaWVudEhlaWdodDtcbiAgICBpZiAodmlkZW9SYXRpbyA+IGNvbnRhaW5lclJhdGlvKSB7XG4gICAgICB2aCA9IGNvbnRhaW5lci5jbGllbnRIZWlnaHQ7XG4gICAgICB2dyA9IHZoICogdmlkZW9SYXRpbztcbiAgICB9IGVsc2Uge1xuICAgICAgdncgPSBjb250YWluZXIuY2xpZW50V2lkdGg7XG4gICAgICB2aCA9IHZ3IC8gdmlkZW9SYXRpbztcbiAgICB9XG5cbiAgICBjb25zdCBwcm9qID0gdGhpcy5jb250cm9sbGVyLmdldFByb2plY3Rpb25NYXRyaXgoKTtcbiAgICBjb25zdCBmb3YgPSAyICogTWF0aC5hdGFuKDEvcHJvals1XSAvIHZoICogY29udGFpbmVyLmNsaWVudEhlaWdodCApICogMTgwIC8gTWF0aC5QSTsgLy8gdmVydGljYWwgZm92XG4gICAgY29uc3QgbmVhciA9IHByb2pbMTRdIC8gKHByb2pbMTBdIC0gMS4wKTtcbiAgICBjb25zdCBmYXIgPSBwcm9qWzE0XSAvIChwcm9qWzEwXSArIDEuMCk7XG4gICAgY29uc3QgcmF0aW8gPSBwcm9qWzVdIC8gcHJvalswXTsgLy8gKHItbCkgLyAodC1iKVxuICAgIC8vY29uc29sZS5sb2coXCJsb2FkZWQgcHJvajogXCIsIHByb2osIFwiLiBmb3Y6IFwiLCBmb3YsIFwiLiBuZWFyOiBcIiwgbmVhciwgXCIuIGZhcjogXCIsIGZhciwgXCIuIHJhdGlvOiBcIiwgcmF0aW8pO1xuICAgIGNvbnN0IG5ld0FzcGVjdCA9IGNvbnRhaW5lci5jbGllbnRXaWR0aCAvIGNvbnRhaW5lci5jbGllbnRIZWlnaHQ7XG4gICAgY29uc3QgY2FtZXJhRWxlID0gY29udGFpbmVyLmdldEVsZW1lbnRzQnlUYWdOYW1lKFwiYS1jYW1lcmFcIilbMF07XG4gICAgY29uc3QgY2FtZXJhID0gY2FtZXJhRWxlLmdldE9iamVjdDNEKCdjYW1lcmEnKTtcbiAgICBjYW1lcmEuZm92ID0gZm92O1xuICAgIGNhbWVyYS5hc3BlY3QgPSBuZXdBc3BlY3Q7XG4gICAgY2FtZXJhLm5lYXIgPSBuZWFyO1xuICAgIGNhbWVyYS5mYXIgPSBmYXI7XG4gICAgY2FtZXJhLnVwZGF0ZVByb2plY3Rpb25NYXRyaXgoKTtcbiAgICAvL2NvbnN0IG5ld0NhbSA9IG5ldyBBRlJBTUUuVEhSRUUuUGVyc3BlY3RpdmVDYW1lcmEoZm92LCBuZXdSYXRpbywgbmVhciwgZmFyKTtcbiAgICAvL2NhbWVyYS5nZXRPYmplY3QzRCgnY2FtZXJhJykucHJvamVjdGlvbk1hdHJpeCA9IG5ld0NhbS5wcm9qZWN0aW9uTWF0cml4O1xuXG4gICAgdGhpcy52aWRlby5zdHlsZS50b3AgPSAoLSh2aCAtIGNvbnRhaW5lci5jbGllbnRIZWlnaHQpIC8gMikgKyBcInB4XCI7XG4gICAgdGhpcy52aWRlby5zdHlsZS5sZWZ0ID0gKC0odncgLSBjb250YWluZXIuY2xpZW50V2lkdGgpIC8gMikgKyBcInB4XCI7XG4gICAgdGhpcy52aWRlby5zdHlsZS53aWR0aCA9IHZ3ICsgXCJweFwiO1xuICAgIHRoaXMudmlkZW8uc3R5bGUuaGVpZ2h0ID0gdmggKyBcInB4XCI7XG4gIH1cbn0pO1xuXG5BRlJBTUUucmVnaXN0ZXJDb21wb25lbnQoJ21pbmRhci1pbWFnZScsIHtcbiAgZGVwZW5kZW5jaWVzOiBbJ21pbmRhci1pbWFnZS1zeXN0ZW0nXSxcblxuICBzY2hlbWE6IHtcbiAgICBpbWFnZVRhcmdldFNyYzoge3R5cGU6ICdzdHJpbmcnfSxcbiAgICBtYXhUcmFjazoge3R5cGU6ICdpbnQnLCBkZWZhdWx0OiAxfSxcbiAgICBmaWx0ZXJNaW5DRjoge3R5cGU6ICdudW1iZXInLCBkZWZhdWx0OiAtMX0sXG4gICAgZmlsdGVyQmV0YToge3R5cGU6ICdudW1iZXInLCBkZWZhdWx0OiAtMX0sXG4gICAgbWlzc1RvbGVyYW5jZToge3R5cGU6ICdpbnQnLCBkZWZhdWx0OiAtMX0sXG4gICAgd2FybXVwVG9sZXJhbmNlOiB7dHlwZTogJ2ludCcsIGRlZmF1bHQ6IC0xfSxcbiAgICBzaG93U3RhdHM6IHt0eXBlOiAnYm9vbGVhbicsIGRlZmF1bHQ6IGZhbHNlfSxcbiAgICBhdXRvU3RhcnQ6IHt0eXBlOiAnYm9vbGVhbicsIGRlZmF1bHQ6IHRydWV9LFxuICAgIHVpTG9hZGluZzoge3R5cGU6ICdzdHJpbmcnLCBkZWZhdWx0OiAneWVzJ30sXG4gICAgdWlTY2FubmluZzoge3R5cGU6ICdzdHJpbmcnLCBkZWZhdWx0OiAneWVzJ30sXG4gICAgdWlFcnJvcjoge3R5cGU6ICdzdHJpbmcnLCBkZWZhdWx0OiAneWVzJ30sXG4gIH0sXG5cbiAgaW5pdDogZnVuY3Rpb24oKSB7XG4gICAgY29uc3QgYXJTeXN0ZW0gPSB0aGlzLmVsLnNjZW5lRWwuc3lzdGVtc1snbWluZGFyLWltYWdlLXN5c3RlbSddO1xuXG4gICAgYXJTeXN0ZW0uc2V0dXAoe1xuICAgICAgaW1hZ2VUYXJnZXRTcmM6IHRoaXMuZGF0YS5pbWFnZVRhcmdldFNyYywgXG4gICAgICBtYXhUcmFjazogdGhpcy5kYXRhLm1heFRyYWNrLFxuICAgICAgZmlsdGVyTWluQ0Y6IHRoaXMuZGF0YS5maWx0ZXJNaW5DRiA9PT0gLTE/IG51bGw6IHRoaXMuZGF0YS5maWx0ZXJNaW5DRixcbiAgICAgIGZpbHRlckJldGE6IHRoaXMuZGF0YS5maWx0ZXJCZXRhID09PSAtMT8gbnVsbDogdGhpcy5kYXRhLmZpbHRlckJldGEsXG4gICAgICBtaXNzVG9sZXJhbmNlOiB0aGlzLmRhdGEubWlzc1RvbGVyYW5jZSA9PT0gLTE/IG51bGw6IHRoaXMuZGF0YS5taXNzVG9sZXJhbmNlLFxuICAgICAgd2FybXVwVG9sZXJhbmNlOiB0aGlzLmRhdGEud2FybXVwVG9sZXJhbmNlID09PSAtMT8gbnVsbDogdGhpcy5kYXRhLndhcm11cFRvbGVyYW5jZSxcbiAgICAgIHNob3dTdGF0czogdGhpcy5kYXRhLnNob3dTdGF0cyxcbiAgICAgIHVpTG9hZGluZzogdGhpcy5kYXRhLnVpTG9hZGluZyxcbiAgICAgIHVpU2Nhbm5pbmc6IHRoaXMuZGF0YS51aVNjYW5uaW5nLFxuICAgICAgdWlFcnJvcjogdGhpcy5kYXRhLnVpRXJyb3IsXG4gICAgfSk7XG4gICAgaWYgKHRoaXMuZGF0YS5hdXRvU3RhcnQpIHtcbiAgICAgIHRoaXMuZWwuc2NlbmVFbC5hZGRFdmVudExpc3RlbmVyKCdyZW5kZXJzdGFydCcsICgpID0+IHtcbiAgICAgICAgYXJTeXN0ZW0uc3RhcnQoKTtcbiAgICAgIH0pO1xuICAgIH1cbiAgfVxufSk7XG5cbkFGUkFNRS5yZWdpc3RlckNvbXBvbmVudCgnbWluZGFyLWltYWdlLXRhcmdldCcsIHtcbiAgZGVwZW5kZW5jaWVzOiBbJ21pbmRhci1pbWFnZS1zeXN0ZW0nXSxcblxuICBzY2hlbWE6IHtcbiAgICB0YXJnZXRJbmRleDoge3R5cGU6ICdudW1iZXInfSxcbiAgfSxcblxuICBwb3N0TWF0cml4OiBudWxsLCAvLyByZXNjYWxlIHRoZSBhbmNob3IgdG8gbWFrZSB3aWR0aCBvZiAxIHVuaXQgPSBwaHlzaWNhbCB3aWR0aCBvZiBjYXJkXG5cbiAgaW5pdDogZnVuY3Rpb24oKSB7XG4gICAgY29uc3QgYXJTeXN0ZW0gPSB0aGlzLmVsLnNjZW5lRWwuc3lzdGVtc1snbWluZGFyLWltYWdlLXN5c3RlbSddO1xuICAgIGFyU3lzdGVtLnJlZ2lzdGVyQW5jaG9yKHRoaXMsIHRoaXMuZGF0YS50YXJnZXRJbmRleCk7XG5cbiAgICBjb25zdCByb290ID0gdGhpcy5lbC5vYmplY3QzRDtcbiAgICByb290LnZpc2libGUgPSBmYWxzZTtcbiAgICByb290Lm1hdHJpeEF1dG9VcGRhdGUgPSBmYWxzZTtcbiAgfSxcblxuICBzZXR1cE1hcmtlcihbbWFya2VyV2lkdGgsIG1hcmtlckhlaWdodF0pIHtcbiAgICBjb25zdCBwb3NpdGlvbiA9IG5ldyBBRlJBTUUuVEhSRUUuVmVjdG9yMygpO1xuICAgIGNvbnN0IHF1YXRlcm5pb24gPSBuZXcgQUZSQU1FLlRIUkVFLlF1YXRlcm5pb24oKTtcbiAgICBjb25zdCBzY2FsZSA9IG5ldyBBRlJBTUUuVEhSRUUuVmVjdG9yMygpO1xuICAgIHBvc2l0aW9uLnggPSBtYXJrZXJXaWR0aCAvIDI7XG4gICAgcG9zaXRpb24ueSA9IG1hcmtlcldpZHRoIC8gMiArIChtYXJrZXJIZWlnaHQgLSBtYXJrZXJXaWR0aCkgLyAyO1xuICAgIHNjYWxlLnggPSBtYXJrZXJXaWR0aDtcbiAgICBzY2FsZS55ID0gbWFya2VyV2lkdGg7XG4gICAgc2NhbGUueiA9IG1hcmtlcldpZHRoO1xuICAgIHRoaXMucG9zdE1hdHJpeCA9IG5ldyBBRlJBTUUuVEhSRUUuTWF0cml4NCgpO1xuICAgIHRoaXMucG9zdE1hdHJpeC5jb21wb3NlKHBvc2l0aW9uLCBxdWF0ZXJuaW9uLCBzY2FsZSk7XG4gIH0sXG5cbiAgdXBkYXRlV29ybGRNYXRyaXgod29ybGRNYXRyaXgpIHtcbiAgICBpZiAoIXRoaXMuZWwub2JqZWN0M0QudmlzaWJsZSAmJiB3b3JsZE1hdHJpeCAhPT0gbnVsbCkge1xuICAgICAgdGhpcy5lbC5lbWl0KFwidGFyZ2V0Rm91bmRcIik7XG4gICAgfSBlbHNlIGlmICh0aGlzLmVsLm9iamVjdDNELnZpc2libGUgJiYgd29ybGRNYXRyaXggPT09IG51bGwpIHtcbiAgICAgIHRoaXMuZWwuZW1pdChcInRhcmdldExvc3RcIik7XG4gICAgfVxuXG4gICAgdGhpcy5lbC5vYmplY3QzRC52aXNpYmxlID0gd29ybGRNYXRyaXggIT09IG51bGw7XG4gICAgaWYgKHdvcmxkTWF0cml4ID09PSBudWxsKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIHZhciBtID0gbmV3IEFGUkFNRS5USFJFRS5NYXRyaXg0KCk7XG4gICAgbS5lbGVtZW50cyA9IHdvcmxkTWF0cml4O1xuICAgIG0ubXVsdGlwbHkodGhpcy5wb3N0TWF0cml4KTtcbiAgICB0aGlzLmVsLm9iamVjdDNELm1hdHJpeCA9IG07XG4gIH1cbn0pO1xuIl0sInNvdXJjZVJvb3QiOiIifQ==