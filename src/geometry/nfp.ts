import { Line, lineLength, Point, pointInPolygon, pointOnLine, Polygon, polygonBounds } from "geometric";
import { gapBetweenDots } from "../utils/Settings";
import { NoFitRasterGpuCalculatorHelper } from "../gpu/NoFitRasterGpuCalculatorHelper";

export const origin: Point = [0.0, 0.0];

export type Vector = [number, number];

export const xAxis: Vector = [1.0, 0.0];
export const yAxis: Vector = [0.0, 1.0];

export function pointAddVector(a: Point, b: Vector): Point {
    return [a[0] + b[0], a[1] + b[1]];
}

export function pointSubtractVector(a: Point, b: Vector): Point {
    return [a[0] - b[0], a[1] - b[1]];
}

export function vectorTo(from: Point, to: Point): Vector {
    return [to[0] - from[0], to[1] - from[1]];
}

export function vectorNormalize(vector: Vector): Vector {
    const length = lineLength([origin, vector]);
    return [vector[0] / length, vector[1] / length];
}

export function vectorMultiply(vector: Vector, a: number): Vector {
    return [vector[0] * a, vector[1] * a];
}

export function lineDirection(line: Line): Vector {
    return vectorNormalize(vectorTo(line[0], line[1]));
}

export function lineSplit(line: Line, gap: number): Point[] {
    let points = [line[0]];

    let point = pointAddVector(line[0], vectorMultiply(lineDirection(line), gap));

    while (pointOnLine(point, line)) {
        points = [...points, point];
        point = pointAddVector(point, vectorMultiply(lineDirection(line), gap));
    }

    return points;
}

export function getRasterPoints(boardBounds: [Point, Point], gap: number): Point[] {
    let dots: Point[] = [];

    let startPoint: Point = [boardBounds[0][0], boardBounds[1][1]];
    let endPoint = boardBounds[1];

    let i = 0;

    while (startPoint[1] >= boardBounds[0][1]) {
        const line: Line = i % 2 == 0 ? [startPoint, endPoint] : [endPoint, startPoint];

        const split = lineSplit(line, gap);

        dots = [...dots, ...split];

        startPoint = pointSubtractVector(startPoint, vectorMultiply(yAxis, gap));
        endPoint = pointSubtractVector(endPoint, vectorMultiply(yAxis, gap));

        i++;
    }

    return dots;
}

export function noFitPolygon(stationaryPolygon: Polygon, orbitingPolygon: Polygon): [number, number][] {
    const stationaryBounds = polygonBounds(stationaryPolygon);
    const orbitingBounds = polygonBounds(orbitingPolygon);

    if (!stationaryBounds || !orbitingBounds) {
        return [];
    }

    const stationaryBoundsSize = vectorTo(stationaryBounds[0], stationaryBounds[1]);
    const orbitingBoundsSize = vectorTo(orbitingBounds[0], orbitingBounds[1]);

    const boardBounds: [Point, Point] = [
        pointSubtractVector(stationaryBounds[0], orbitingBoundsSize),
        pointAddVector(stationaryBounds[0], stationaryBoundsSize),
    ];

    const boardDots = getRasterPoints(boardBounds, gapBetweenDots);

    const stationaryDots = boardDots.filter((x) => pointInPolygon(x, stationaryPolygon));
    const orbitingDots = boardDots.filter((x) => pointInPolygon(x, orbitingPolygon));

    const orbitingDotsBounds = polygonBounds(orbitingDots);

    if (!orbitingDotsBounds) {
        return [];
    }

    const orbitingDotsMinimumPoint = orbitingDotsBounds[0];

    return NoFitRasterGpuCalculatorHelper.noFitRaster(
        boardDots,
        stationaryDots,
        orbitingDots,
        orbitingDotsMinimumPoint,
    );
}
