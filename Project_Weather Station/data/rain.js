/*************************************************
 * PAPER RAIN BACKGROUND ENGINE (FIXED FULLSCREEN)
 *************************************************/

var RENDERER = {
  INIT_RAIN_DROP_COUNT: 1500,
  RAIN_DROP_COUNT: 8,
  HUMAN_COUNT: 30,
  COLOR: 'hsl(%hue, 20%, %luminance%)',
  HUE_OFFSET: Math.PI / 1000,
  LUMINANCE_OFFSET: Math.PI / 1500,

  init: function () {
    this.$container = $('#jsi-rain-container');
    this.setParameters();
    this.reconstructMethod();
    this.createRainDrops(this.INIT_RAIN_DROP_COUNT, true);
    this.createHumans();
    this.bindResize();
    this.render();
  },

  /* ===============================
   * SETUP CANVAS + DPI SCALE
   * =============================== */
  setParameters: function () {
    this.dpr = window.devicePixelRatio || 1;

    this.width = window.innerWidth;
    this.height = window.innerHeight;

    this.canvas = document.createElement('canvas');
    this.canvas.style.position = 'absolute';
    this.canvas.style.top = 0;
    this.canvas.style.left = 0;
    this.canvas.style.zIndex = 0;

    this.$container.append(this.canvas);

    this.context = this.canvas.getContext('2d');

    this.resizeCanvas();

    this.rainDrops = [];
    this.humans = [];
    this.theta = 0;
    this.phi = 0;
  },

  resizeCanvas: function () {
    this.dpr = window.devicePixelRatio || 1;

    this.width = window.innerWidth;
    this.height = window.innerHeight;

    this.canvas.width = this.width * this.dpr;
    this.canvas.height = this.height * this.dpr;

    this.canvas.style.width = this.width + 'px';
    this.canvas.style.height = this.height + 'px';

    this.context.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  },

  bindResize: function () {
    window.addEventListener('resize', () => {
      this.resizeCanvas();
    });
  },

  reconstructMethod: function () {
    this.render = this.render.bind(this);
  },

  getRandomValue: function (range) {
    return range.min + (range.max - range.min) * Math.random();
  },

  createRainDrops: function (count, toInit) {
    for (var i = 0; i < count; i++) {
      this.rainDrops.push(new RAIN_DROP(this.width, this.height, toInit, this));
    }
  },

  createHumans: function () {
    for (var i = 0; i < this.HUMAN_COUNT; i++) {
      this.humans.push(new HUMAN(this.width, this.height, this));
    }
  },

  /* ===============================
   * MAIN RENDER LOOP
   * =============================== */
  render: function () {
    requestAnimationFrame(this.render);

    this.color = this.COLOR.replace('%hue', 205 + 5 * Math.sin(this.phi));
    this.context.fillStyle = this.color.replace(
      '%luminance',
      35 + 5 * Math.sin(this.theta)
    );
    this.context.fillRect(0, 0, this.width, this.height);

    for (let i = this.rainDrops.length - 1; i >= 0; i--) {
      if (!this.rainDrops[i].render(this.context, false)) {
        this.rainDrops.splice(i, 1);
      }
    }

    this.humans.sort((a, b) => a.y - b.y);
    this.humans.forEach(h => h.renderShadow(this.context));
    this.humans.forEach(h => h.renderSubstance(this.context));

    for (let i = this.rainDrops.length - 1; i >= 0; i--) {
      if (!this.rainDrops[i].render(this.context, true)) {
        this.rainDrops.splice(i, 1);
      }
    }

    this.createRainDrops(this.RAIN_DROP_COUNT, false);

    this.theta = (this.theta + this.LUMINANCE_OFFSET) % (Math.PI * 2);
    this.phi = (this.phi + this.HUE_OFFSET) % (Math.PI * 2);
  }
};

/*************************************************
 * RAIN DROP
 *************************************************/
var RAIN_DROP = function (width, height, toInit, renderer) {
  this.width = width;
  this.height = height;
  this.toInit = toInit;
  this.renderer = renderer;
  this.init();
};

RAIN_DROP.prototype = {
  SCALE_RANGE: { min: 0.3, max: 1.2 },
  VELOCITY_RANGE: { min: -2, max: -1 },
  VELOCITY_RATE: 4,
  LENGTH_RATE: 25,
  ACCELARATION_RATE: 0.02,
  VERTICAL_OFFSET_RATE: 0.05,
  FRONT_THRESHOLD: 0.7,
  REFLECTION_RADIUS_RATE: 0.03,
  COLOR: 'rgba(255,255,255,0.75)',
  RADIUS_RATE: 0.25,

  init: function () {
    this.scale = this.renderer.getRandomValue(this.SCALE_RANGE);
    this.length = this.LENGTH_RATE * this.scale;
    this.vx = this.renderer.getRandomValue(this.VELOCITY_RANGE) * this.scale;
    this.vy = this.VELOCITY_RATE * this.scale;
    this.ay = this.ACCELARATION_RATE * this.scale;

    this.theta = Math.atan2(this.vy, this.vx);
    this.offset = this.height * this.VERTICAL_OFFSET_RATE;

    this.x = Math.random() * this.width;
    this.y = (this.toInit ? Math.random() * this.height : 0) - this.offset;
    this.radius = this.length * this.REFLECTION_RADIUS_RATE;
  },

  render: function (ctx, toFront) {
    if (
      (toFront && this.scale < this.FRONT_THRESHOLD) ||
      (!toFront && this.scale >= this.FRONT_THRESHOLD)
    ) return true;

    ctx.strokeStyle = this.COLOR;
    ctx.lineWidth = 1.2;

    if (this.y >= this.height - this.offset) {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius, Math.PI, Math.PI * 2);
      ctx.stroke();
      this.radius *= 1.08;
      return this.radius <= this.length * this.RADIUS_RATE;
    } else {
      ctx.beginPath();
      ctx.moveTo(this.x, this.y);
      ctx.lineTo(
        this.x + this.length * Math.cos(this.theta),
        this.y + this.length * Math.sin(this.theta)
      );
      ctx.stroke();

      this.x += this.vx;
      this.y += this.vy;
      this.vy += this.ay;
    }
    return true;
  }
};

/*************************************************
 * HUMAN (GIỮ NGUYÊN)
 *************************************************/
var HUMAN = function (width, height, renderer) {
  this.width = width;
  this.height = height;
  this.renderer = renderer;
  this.init();
};

HUMAN.prototype = {
  HORIZONTAL_OFFSET: 30,
  VERTICAL_OFFSET_RATE_RANGE: { min: 0.05, max: 0.45 },
  VELOCITY_OFFSET: { min: 0.3, max: 0.6 },

  init: function () {
    this.setParameters(true);
  },

  setParameters: function (toInit) {
    this.direction = Math.random() < 0.5 ? 1 : -1;
    this.x = toInit
      ? Math.random() * this.width
      : this.direction > 0
      ? -this.HORIZONTAL_OFFSET
      : this.width + this.HORIZONTAL_OFFSET;

    this.y =
      this.height -
      Math.random() *
        (this.VERTICAL_OFFSET_RATE_RANGE.max -
          this.VERTICAL_OFFSET_RATE_RANGE.min) *
        this.height;

    this.vx = Math.random() * this.VELOCITY_OFFSET.max * this.direction;
  },

  renderSubstance: function () {
    this.x += this.vx;
    if (this.x < -this.HORIZONTAL_OFFSET || this.x > this.width + this.HORIZONTAL_OFFSET) {
      this.setParameters(false);
    }
  },

  renderShadow: function () {}
};

/*************************************************
 * AUTO INIT
 *************************************************/
$(function () {
  RENDERER.init();
});
