import { Line, lineLength, Point, pointRotate, Polygon, polygonArea } from "geometric";
import { clipperScale, partToPartGap, tolerance } from "./utils";
import Shape from "@doodle3d/clipper-js";
import { origin } from "./nesting";

export type Vector = [number, number];

export function pointDistanceTo(a: Point, b: Point): number {
    return Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2);
}

export function pointVectorTo(a: Point, b: Point): Vector {
    return [b[0] - a[0], b[1] - a[1]];
}

export function vectorAdd(a: Vector, b: Vector): Vector {
    return [a[0] + b[0], a[1] + b[1]];
}

export function vectorSubtract(a: Vector, b: Vector): Vector {
    return [a[0] - b[0], a[1] - b[1]];
}

export function vectorDotProduct(a: Vector, b: Vector): number {
    return a[0] * b[0] + a[1] * b[1];
}

export function vectorLength(vector: Vector): number {
    return Math.sqrt(vector[0] * vector[0] + vector[1] * vector[1]);
}

export function vectorNormalize(vector: Vector): Vector {
    const length = vectorLength(vector);
    return [vector[0] / length, vector[1] / length];
}

export function lineDirection(line: Line): Vector {
    return vectorNormalize(pointVectorTo(line[0], line[1]));
}

export function lineClosestPointTo(line: Line, p: Point): Point {
    let num = vectorDotProduct(pointVectorTo(line[0], p), lineDirection(line));
    if (num < 0.0) num = 0.0;
    const length = lineLength(line);
    if (num > length) {
        num = length;
    }
    return vectorAdd(line[0], [num * lineDirection(line)[0], num * lineDirection(line)[1]]);
}

export function angleNormalize(angle: number): number {
    const normalized = angle % 360.0;
    return normalized < 0.0 ? 360.0 + normalized : normalized;
}

export function polygonTranslateByVector(polygon: Polygon, vector: Vector): Polygon {
    return polygon.map((x) => [x[0] + vector[0], x[1] + vector[1]]);
}

export function polygonsToShape(polygons: Polygon[]): Shape {
    return new Shape(
        polygons.map((polygon) => polygon.map((p) => ({ X: p[0], Y: p[1] }))),
        true,
    );
}

export function shapeToPolygons(shape: Shape): Polygon[] {
    return shape.paths.map((polygon) => polygon.map((p) => [p.X, p.Y]));
}

export function polygonOffset(points: Polygon, delta: number): Polygon[] {
    if (!points) {
        return [];
    }

    return shapeToPolygons(
        polygonsToShape([points]).offset(delta, {
            jointType: "jtRound",
            endType: "etClosedPolygon",
            miterLimit: 2.0,
            roundPrecision: tolerance * clipperScale,
        }),
    );
}

export function polygonSimplify(points: Polygon): Polygon {
    if (!points) {
        return [];
    }

    const simplifiedPolygons = shapeToPolygons(polygonsToShape([points]).simplify("pftNonZero"));

    if (!simplifiedPolygons) {
        return [];
    }

    return simplifiedPolygons.sort((x) => polygonArea(x, false)).reverse()[0];
}

export function polygonClean(points: Polygon, tolerance: number): Polygon {
    return shapeToPolygons(polygonsToShape([points]).clean(tolerance * clipperScale))[0];
}

export function polygonClosestPointTo(polygon: Polygon, p: Point): Point {
    let num1 = Number.MAX_SAFE_INTEGER;
    let point = origin;

    for (let index = 0; index < polygon.length - 1; ++index) {
        const otherPoint = lineClosestPointTo([polygon[index], polygon[index + 1]], p);
        const num2 = pointDistanceTo(p, otherPoint);
        if (num2 < num1) {
            num1 = num2;
            point = otherPoint;
        }
    }

    return point;
}

export interface RestPoint {
    x: number;
    y: number;
}

export function restPointToPoint(restPoint: RestPoint): Point {
    return [restPoint.x, restPoint.y];
}

export function pointToRestPoint(point: Point): RestPoint {
    return {
        x: point[0],
        y: point[1],
    };
}

export interface Entity {
    layer: string;
    nestingId: string;
    nestingKey: string;
    nestingRotationInDegrees?: string;
    extentsPoints: RestPoint[];
    bounds: RestPoint[];
    isCircle: boolean;
    circleDiameter?: number;
}

export function entityWithLayer(entity: Entity, layer: string): Entity {
    return {
        ...entity,
        layer: layer,
    };
}

export function entityWithNestingMetaData(
    entity: Entity,
    nestingId: string,
    nestingKey: string,
    nestingRotationInDegrees: string,
): Entity {
    return {
        ...entity,
        nestingId: nestingId,
        nestingKey: nestingKey,
        nestingRotationInDegrees: nestingRotationInDegrees,
    };
}

export function entityTranslate(entity: Entity, vector: [number, number]): Entity {
    return {
        ...entity,
        extentsPoints: entity.extentsPoints.map((x) => ({ x: x.x + vector[0], y: x.y + vector[1] })),
        bounds: entity.bounds.map((x) => ({ x: x.x + vector[0], y: x.y + vector[1] })),
    };
}

export function entityRotate(entity: Entity, angle: number): Entity {
    return {
        ...entity,
        nestingRotationInDegrees: entity.nestingRotationInDegrees
            ? `${angleNormalize(parseFloat(entity.nestingRotationInDegrees) + angle)}`
            : undefined,
        extentsPoints: entity.extentsPoints.map((x) => pointToRestPoint(pointRotate(restPointToPoint(x), angle))),
        bounds: entity.bounds.map((x) => pointToRestPoint(pointRotate(restPointToPoint(x), angle))),
    };
}

export interface Part {
    outsideLoop: Entity;
    insideLoops: Entity[];
}

export function boundsSize(bounds: [Point, Point]): [number, number] {
    return [bounds[1][0] - bounds[0][0], bounds[1][1] - bounds[0][1]];
}

export function boundsOffset(bounds: [Point, Point], delta: number): [Point, Point] {
    return [
        [bounds[0][0] - delta, bounds[0][1] - delta],
        [bounds[1][0] + 2 * delta, bounds[1][1] + 2 * delta],
    ];
}

export function boundsExtentsPoints(bounds: [Point, Point]) {
    const size = boundsSize(bounds);
    return [bounds[0], vectorAdd(bounds[0], [size[0], 0]), bounds[1], vectorAdd(bounds[0], [0, size[1]])];
}

export function boundsFromMinimumPointAndSize(minimumPoint: Point, size: [number, number]): [Point, Point] {
    return [minimumPoint, [minimumPoint[0] + size[0], minimumPoint[1] + size[1]]];
}

export function partNestingBounds(part: Part): [Point, Point] {
    return boundsOffset(part.outsideLoop.bounds.map((x) => restPointToPoint(x)) as [Point, Point], partToPartGap / 2);
}

export function partWithNestingMetaData(
    part: Part,
    nestingId: string,
    nestingKey: string,
    nestingRotationInDegrees: string,
): Part {
    return {
        ...part,
        outsideLoop: entityWithNestingMetaData(part.outsideLoop, nestingId, nestingKey, nestingRotationInDegrees),
    };
}

export function partTranslate(part: Part, vector: [number, number]): Part {
    return {
        outsideLoop: entityTranslate(part.outsideLoop, vector),
        insideLoops: part.insideLoops.map((insideLoop) => entityTranslate(insideLoop, vector)),
    };
}

export function partMoveTo(part: Part, point: Point): Part {
    const nestingBoundMinimumPoint = partNestingBounds(part)[0];
    return partTranslate(part, [point[0] - nestingBoundMinimumPoint[0], point[1] - nestingBoundMinimumPoint[1]]);
}

export function partRotate(part: Part, angle: number): Part {
    return {
        outsideLoop: entityRotate(part.outsideLoop, angle),
        insideLoops: part.insideLoops.map((insideLoop) => entityRotate(insideLoop, angle)),
    };
}
