/**
 * represents a 2d vector
 */
export class Point {
    constructor(public x: number = 0, public y: number = 0) { }

    /**
     * rotate the vector around a pivot point and return a new result vector
     */
    rotate(pivot: Point, angle: number): Vector {
        // http://stackoverflow.com/questions/2259476/rotating-a-point-about-another-point-2d
        // answer by six face
        let sinA = Math.sin(angle);
        let cosA = Math.cos(angle);
        return new Vector(
            cosA * (this.x - pivot.x) - sinA * (this.y - pivot.y) + pivot.x,
            sinA * (this.x - pivot.x) + cosA * (this.y - pivot.y) + pivot.y
        );
    }

    /**
     * generate a result vector by adding v
     */
    public add(v: Point): Vector {
        return new Vector(this.x + v.x, this.y + v.y);
    }

    /**
     * multiply by n
     */
    public multiply(n: number): Vector {
        return new Vector(this.x * n, this.y * n);
    }

    /**
     * subtract vector v
     */
    public subtract(v: Point): Vector {
        return new Vector(this.x - v.x, this.y - v.y);
    }
}

/**
 * represents a point on a 2d surface
 */
export class Vector extends Point {
    /**
     * generates the Normal A Vector
     */
    public normalA(): Vector {
        return new Vector(-this.y, this.x);
    }

    /**
     * generates the Normal B Vector
     */
    public normalB(): Vector {
        return new Vector(this.y, -this.x);
    }

    /**
     * calculates the vector length
     */
    public length(): number {
        return Math.sqrt(Math.pow(this.x, 2) + Math.pow(this.y, 2));
    }
}

export class Collision {
    constructor(public point: Point, public segmentStart: Point, public segmentEnd: Point) { }
}

/**
 * checks if lander geometry overlaps with terrain
 * returns the indices of a overlapping with b 
 */
export function isOverlap(lander: Point[], terrain: Point[]): Collision[] {
    let collisions: Collision[] = [];
    let segmentWidth = terrain[1].x;
    lander.map((point, i) => {
        // first find corresponding terrain segment for x-pos of lander
        let segment = Math.floor(point.x / segmentWidth);
        let a: Point, b: Point;
        if (segment < 0) {
            a = new Point(point.x - 1, terrain[0].y);
            b = terrain[0];
        } else if (segment >= terrain.length) {
            a = terrain[terrain.length - 1];
            b = new Point(point.x + 1, terrain[terrain.length - 1].y);
        } else {
            a = terrain[segment] || terrain[segment + 1];
            b = terrain[segment + 1] || terrain[segment];
        }
        // interpolate the segments y-value for the landers x-pos
        let relativeX = (point.x - a.x) / (b.x - a.x);
        let y = a.y + (b.y - a.y) * relativeX;
        // check if the lander overlaps
        if (point.y <= y) {
            collisions.push(new Collision(point, a, b));
        }
    });
    return collisions;
}

/**
 * calculate the dotproduct of the vectors
 */
export function dot(a: Vector, b: Vector): number {
    return a.x * b.x + a.y * b.y;
}