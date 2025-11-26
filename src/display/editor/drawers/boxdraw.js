import { Outline } from "./outline.js";
import { MathClamp } from "../../../shared/util.js";

class BoxDrawOutliner {
  #startX;
  #startY;
  #parentWidth;
  #parentHeight;
  #rotation;
  #bbox = new Float32Array([0, 0, 0, 0]);

  constructor(x, y, parentWidth, parentHeight, rotation) {
    this.#parentWidth = parentWidth;
    this.#parentHeight = parentHeight;
    this.#rotation = rotation;
    [this.#startX, this.#startY] = Outline._normalizePoint(
      x,
      y,
      parentWidth,
      parentHeight,
      rotation
    );
    this.#bbox.set([this.#startX, this.#startY, 0, 0]);
  }

  startNew(x, y, parentWidth, parentHeight, rotation) {
    this.#parentWidth = parentWidth;
    this.#parentHeight = parentHeight;
    this.#rotation = rotation;
    [this.#startX, this.#startY] = Outline._normalizePoint(
      x,
      y,
      parentWidth,
      parentHeight,
      rotation
    );
    this.#bbox.set([this.#startX, this.#startY, 0, 0]);
    return null;
  }

  add(x, y) {
    const [nx, ny] = Outline._normalizePoint(
      x,
      y,
      this.#parentWidth,
      this.#parentHeight,
      this.#rotation
    );
    const x1 = Math.min(this.#startX, nx);
    const y1 = Math.min(this.#startY, ny);
    const x2 = Math.max(this.#startX, nx);
    const y2 = Math.max(this.#startY, ny);
    const width = MathClamp(x2 - x1, 0, 1);
    const height = MathClamp(y2 - y1, 0, 1);
    this.#bbox.set([x1, y1, width, height]);
    return {
      root: { viewBox: this.viewBox },
      path: { d: this.toSVGPath() },
      bbox: this.#bbox,
    };
  }

  end(x, y) {
    const change = this.add(x, y);
    const w = this.#bbox[2] * this.#parentWidth;
    const h = this.#bbox[3] * this.#parentHeight;
    if (w <= 2 && h <= 2) {
      const sidePx = 100;
      const sideX = sidePx / this.#parentWidth;
      const sideY = sidePx / this.#parentHeight;
      const nx = Math.min(this.#startX, 1 - sideX);
      const ny = Math.min(this.#startY, 1 - sideY);
      this.#bbox.set([Math.max(0, nx), Math.max(0, ny), sideX, sideY]);
      return {
        root: { viewBox: this.viewBox },
        path: { d: this.toSVGPath() },
        bbox: this.#bbox,
      };
    }
    return change;
  }

  getOutlines() {
    return new BoxDrawOutline(this.#bbox);
  }

  isEmpty() {
    return this.#bbox[2] === 0 && this.#bbox[3] === 0;
  }

  isCancellable() {
    const w = this.#bbox[2] * this.#parentWidth;
    const h = this.#bbox[3] * this.#parentHeight;
    return w <= 2 && h <= 2;
  }

  get defaultSVGProperties() {
    return { root: { viewBox: this.viewBox }, path: { d: this.toSVGPath() }, bbox: this.#bbox };
  }

  toSVGPath() {
    return "M0 0 H1 V1 H0 Z";
  }

  get viewBox() {
    return this.#bbox.map(Outline.svgRound).join(" ");
  }
}

class BoxDrawOutline extends Outline {
  #bbox;
  #currentRotation = 0;

  constructor(bbox) {
    super();
    this.#bbox = new Float32Array(bbox);
  }

  toSVGPath() {
    return "M0 0 H1 V1 H0 Z";
  }

  get box() {
    return this.#bbox;
  }

  get defaultProperties() {
    const [x, y] = this.#bbox;
    return { root: { viewBox: this.viewBox }, path: { "transform-origin": `${Outline.svgRound(x)} ${Outline.svgRound(y)}` } };
  }

  get defaultSVGProperties() {
    const bbox = this.#bbox;
    return {
      root: { viewBox: this.viewBox },
      path: {
        d: this.toSVGPath(),
        "transform-origin": `${Outline.svgRound(bbox[0])} ${Outline.svgRound(bbox[1])}`,
        transform: this.rotationTransform || null,
      },
      bbox,
    };
  }

  get viewBox() {
    return this.#bbox.map(Outline.svgRound).join(" ");
  }

  updateParentDimensions([_w, _h], _scale) {
    return this.#bbox;
  }

  updateRotation(rotation) {
    this.#currentRotation = rotation;
    return { path: { transform: this.rotationTransform } };
  }

  get rotationTransform() {
    const [, , width, height] = this.#bbox;
    let a = 0, b = 0, c = 0, d = 0, e = 0, f = 0;
    switch (this.#currentRotation) {
      case 90:
        b = height / width;
        c = -width / height;
        e = width;
        break;
      case 180:
        a = -1;
        d = -1;
        e = width;
        f = height;
        break;
      case 270:
        b = -height / width;
        c = width / height;
        f = height;
        break;
      default:
        return "";
    }
    return `matrix(${a} ${b} ${c} ${d} ${Outline.svgRound(e)} ${Outline.svgRound(f)})`;
  }

  getPathResizingSVGProperties([newX, newY, newWidth, newHeight]) {
    const [x, y, width, height] = this.#bbox;
    const s1x = newWidth / width;
    const s1y = newHeight / height;
    return {
      path: {
        "transform-origin": `${Outline.svgRound(x)} ${Outline.svgRound(y)}`,
        transform: `${this.rotationTransform} scale(${s1x} ${s1y}) translate(${Outline.svgRound(newX - x)} ${Outline.svgRound(newY - y)})`,
      },
    };
  }

  getPathResizedSVGProperties([newX, newY, newWidth, newHeight]) {
    this.#bbox[0] = newX;
    this.#bbox[1] = newY;
    this.#bbox[2] = newWidth;
    this.#bbox[3] = newHeight;
    return {
      root: { viewBox: this.viewBox },
      path: {
        "transform-origin": `${Outline.svgRound(newX)} ${Outline.svgRound(newY)}`,
        transform: this.rotationTransform || null,
        d: this.toSVGPath(),
      },
    };
  }

  getPathTranslatedSVGProperties([newX, newY]) {
    const [x, y] = this.#bbox;
    const tx = newX - x;
    const ty = newY - y;
    this.#bbox[0] = newX;
    this.#bbox[1] = newY;
    return {
      root: { viewBox: this.viewBox },
      path: {
        d: this.toSVGPath(),
        "transform-origin": `${Outline.svgRound(newX)} ${Outline.svgRound(newY)}`,
        transform: `${this.rotationTransform} translate(${Outline.svgRound(tx)} ${Outline.svgRound(ty)})`,
      },
    };
  }

  updateProperty(_name, _value) {
    return null;
  }

  serialize([pageX, pageY, pageWidth, pageHeight], isForCopying) {
    const [x, y, width, height] = this.#bbox;
    let tx, ty, sx, sy, x1, y1, x2, y2, rescaleFn;
    switch (this.#currentRotation) {
      case 0:
        rescaleFn = Outline._rescale;
        tx = pageX;
        ty = pageY + pageHeight;
        sx = pageWidth;
        sy = -pageHeight;
        x1 = pageX + x * pageWidth;
        y1 = pageY + (1 - y - height) * pageHeight;
        x2 = pageX + (x + width) * pageWidth;
        y2 = pageY + (1 - y) * pageHeight;
        break;
      case 90:
        rescaleFn = Outline._rescaleAndSwap;
        tx = pageX;
        ty = pageY;
        sx = pageWidth;
        sy = pageHeight;
        x1 = pageX + y * pageWidth;
        y1 = pageY + x * pageHeight;
        x2 = pageX + (y + height) * pageWidth;
        y2 = pageY + (x + width) * pageHeight;
        break;
      case 180:
        rescaleFn = Outline._rescale;
        tx = pageX + pageWidth;
        ty = pageY;
        sx = -pageWidth;
        sy = pageHeight;
        x1 = pageX + (1 - x - width) * pageWidth;
        y1 = pageY + y * pageHeight;
        x2 = pageX + (1 - x) * pageWidth;
        y2 = pageY + (y + height) * pageHeight;
        break;
      case 270:
        rescaleFn = Outline._rescaleAndSwap;
        tx = pageX + pageWidth;
        ty = pageY + pageHeight;
        sx = -pageWidth;
        sy = -pageHeight;
        x1 = pageX + (1 - y - height) * pageWidth;
        y1 = pageY + (1 - x - width) * pageHeight;
        x2 = pageX + (1 - y) * pageWidth;
        y2 = pageY + (1 - x) * pageHeight;
        break;
      default:
        rescaleFn = Outline._rescale;
        tx = pageX;
        ty = pageY + pageHeight;
        sx = pageWidth;
        sy = -pageHeight;
        x1 = pageX + x * pageWidth;
        y1 = pageY + (1 - y - height) * pageHeight;
        x2 = pageX + (x + width) * pageWidth;
        y2 = pageY + (1 - y) * pageHeight;
        break;
    }

    // Rectangle points clockwise: top-left, top-right, bottom-right, bottom-left.
    const rectPoints = new Float32Array([
      x, y,
      x + width, y,
      x + width, y + height,
      x, y + height,
    ]);

    // Points: corners clockwise
    const points = [rescaleFn(rectPoints, tx, ty, sx, sy, isForCopying ? new Array(8) : null)];
    // Outline for highlight (closed path), using the same corner list transformed
    const outline = rescaleFn(
      new Float32Array([
        NaN, NaN, NaN, NaN,
        rectPoints[0], rectPoints[1],
        NaN, NaN, NaN, NaN,
        rectPoints[2], rectPoints[3],
        NaN, NaN, NaN, NaN,
        rectPoints[4], rectPoints[5],
        NaN, NaN, NaN, NaN,
        rectPoints[6], rectPoints[7],
      ]),
      tx,
      ty,
      sx,
      sy,
      isForCopying ? new Array(24) : null
    );
    const lines = [outline];

    return {
      lines,
      points,
      outline,
      rect: [x1, y1, x2, y2],
    };
  }
}

export { BoxDrawOutliner, BoxDrawOutline };
