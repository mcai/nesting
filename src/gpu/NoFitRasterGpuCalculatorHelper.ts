import { GPU } from "gpu.js";
import { polygonBounds } from "geometric";

export class NoFitRasterGpuCalculatorHelper {
    private static gpu = new GPU({
        mode: "gpu",
    });

    static noFitRaster(
        boardDots: [number, number][],
        stationaryDots: [number, number][],
        orbitingDots: [number, number][],
    ): [number, number][] {
        const kernelFunc = this.gpu
            .createKernel(function (
                boardDots: [number, number][],
                stationaryDots: [number, number][],
                orbitingDots: [number, number][],
                orbitingDotsMinimumPoint: [number, number],
            ) {
                for (let k = 0; k < this.constants.numOrbitingDots; k++) {
                    const x1 = orbitingDots[k][0] + boardDots[this.thread.y][0];
                    const x2 = orbitingDotsMinimumPoint[0] + stationaryDots[this.thread.x][0];
                    const y1 = orbitingDots[k][1] + boardDots[this.thread.y][1];
                    const y2 = orbitingDotsMinimumPoint[1] + stationaryDots[this.thread.x][1];

                    if (x1 == x2 && y1 == y2) {
                        return 1;
                    }
                }

                return 0;
            })
            .setOutput([stationaryDots.length, boardDots.length])
            .setConstants({
                numOrbitingDots: orbitingDots.length,
            });

        const orbitingDotsBounds = polygonBounds(orbitingDots);

        if (!orbitingDotsBounds) {
            return [];
        }

        const orbitingDotsMinimumPoint = orbitingDotsBounds[0];

        const out: any = kernelFunc(boardDots, stationaryDots, orbitingDots, orbitingDotsMinimumPoint);

        return boardDots.filter((value, index) => out[index].some((x: number) => x == 1));
    }

    static rasterDifference(a: [number, number][], b: [number, number][]): [number, number][] {
        const kernelFunc = this.gpu
            .createKernel(function (a: [number, number][], b: [number, number][]) {
                for (let k = 0; k < this.constants.numB; k++) {
                    const x1 = b[k][0];
                    const x2 = a[this.thread.x][0];
                    const y1 = b[k][1];
                    const y2 = a[this.thread.x][1];

                    if (x1 == x2 && y1 == y2) {
                        return 0;
                    }
                }

                return 1;
            })
            .setOutput([a.length])
            .setConstants({
                numB: b.length,
            });

        const out: any = kernelFunc(a, b);

        return a.filter((value, index) => out[index] == 1);
    }
}
