import { BASE_ANGLE, SPEED, SYNC_PER_FRAME } from 'common/config';
import { GameMap } from '~/framework/GameMap';
import { ObserverInterface } from '~/framework/Observer';
import { getSnakeHeader } from '~/libs/imageStore';
import { gameMap } from '~/main';
import { Base, BaseOptions } from './Base';
import { Food } from './Food';

interface SnakeOptions extends BaseOptions {
  length?: number;
  angle?: number;
  fillColor?: string;
  strokeColor?: string;
}

export class Movements {
  [proName: string]: any;

  constructor(
    public x: number,
    public y: number,
    public speed: number,
    public angle: number,
  ) { }
}

export class Snake extends Base implements ObserverInterface {
  public img?: HTMLCanvasElement;
  public point: number = 0;
  public isSpeedUp: boolean = false;
  public fillColor: string = '';
  public angle: number;
  public stopped: boolean = false;

  // save snake's movement
  public movementQueue: Movements[] = [];

  // max length of queue
  public movementQueueLen: number;
  public speed: number = SPEED;
  public oldSpeed: number = SPEED;
  private length: number;
  private toAngle: number;
  private vx: number = 0;
  private vy: number = 0;

  constructor(
    options: SnakeOptions,
    bodyCoords?: number[],
  ) {
    super(options);
    const strokeColor: string = options.strokeColor || '#000';
    this.fillColor = options.fillColor || '#fff';
    this.toAngle = this.angle = (options.angle || 0) + BASE_ANGLE;
    this.length = options.length;
    this.updateSize();
    this.velocity();
  }

  public updateSize(added: number = 0): void {
    this.width += added;
    this.height += added;
    this.length += added * 50;
    this.img = getSnakeHeader(this.width, this.height);
    this.movementQueueLen = Math.ceil(this.length / this.oldSpeed);
  }

  // move to new position
  public moveTo(nx: number, ny: number): void {
    const x: number = nx - this.x;
    const y: number = this.y - ny;
    let angle: number = Math.atan(Math.abs(x / y));

    // calculate angle, value is 0-360
    if (x > 0 && y < 0) {
      angle = Math.PI - angle;
    } else if (x < 0 && y < 0) {
      angle = Math.PI + angle;
    } else if (x < 0 && y > 0) {
      angle = Math.PI * 2 - angle;
    }

    const oldAngle: number = Math.abs(this.toAngle % (Math.PI * 2));

    // number of turns
    let rounds: number = ~~(this.toAngle / (Math.PI * 2));

    this.toAngle = angle;

    if (oldAngle >= Math.PI * 3 / 2 && this.toAngle <= Math.PI / 2) {
      // move from fourth quadrant to first quadrant
      rounds++;
    } else if (oldAngle <= Math.PI / 2 && this.toAngle >= Math.PI * 3 / 2) {
      // move from first quadrant to fourth quadrant
      rounds--;
    }

    // calculate the real angle by rounds
    this.toAngle += rounds * Math.PI * 2;
  }

  // calculate horizontal speed and vertical speed by angle of snake header
  public velocity(): void {
    const angle: number = this.angle % (Math.PI * 2);
    const vx: number = Math.abs(this.speed * Math.sin(angle));
    const vy: number = Math.abs(this.speed * Math.cos(angle));

    if (angle < Math.PI / 2) {
      this.vx = vx;
      this.vy = -vy;
    } else if (angle < Math.PI) {
      this.vx = vx;
      this.vy = vy;
    } else if (angle < Math.PI * 3 / 2) {
      this.vx = -vx;
      this.vy = vy;
    } else {
      this.vx = -vx;
      this.vy = -vy;
    }
  }

  // turn around
  public turnAround(): void {
    const angleDistance: number = this.toAngle - this.angle;
    const turnSpeed: number = 0.045;

    if (Math.abs(angleDistance) <= turnSpeed) {
      // reset angle
      this.toAngle = this.angle = BASE_ANGLE + this.toAngle % (Math.PI * 2);
    } else {
      this.angle += Math.sign(angleDistance) * turnSpeed;
    }
  }

  public speedUp(): void {
    if (this.isSpeedUp) {
      return;
    }

    this.isSpeedUp = true;
    this.oldSpeed = this.speed;
    this.speed *= 2;
  }

  public speedDown(): void {
    if (!this.isSpeedUp) {
      return;
    }

    this.isSpeedUp = false;
    this.speed = this.oldSpeed;
  }

  // eat food
  public eat(food: Food): number {
    this.point += food.point;

    // add points
    const added = food.point / 200;
    this.updateSize(added);
    return added;
  }

  // snake action
  public action() {
    // save movement
    this.movementQueue.push(
      new Movements(this.x, this.y, this.speed, this.angle),
    );

    if (this.movementQueue.length > this.movementQueueLen) {
      this.movementQueue.shift();
    }

    this.turnAround();
    this.velocity();
    this.x += this.vx;
    this.y += this.vy;

    // avoid moving to outside
    gameMap.limit(this);
  }

  // render snake
  public render(): void {
    gameMap.ctx.save();
    gameMap.ctx.beginPath();
    gameMap.ctx.moveTo(this.paintX, this.paintY);

    // stroke body
    let wholeLength = this.length;
    if (this.movementQueue.length) {
      let i = this.movementQueue.length - 1;
      while (i) {
        const movement = this.movementQueue[i];
        let x = movement.x;
        let y = movement.y;
        if (wholeLength > 0 && wholeLength < movement.speed) {
          const lm = this.movementQueue[i + 1] || this;
          const ratio = wholeLength / movement.speed;
          x = lm.x - (lm.x - x) * ratio;
          y = lm.y - (lm.y - y) * ratio;
        } else if (wholeLength < 0) {
          break;
        }

        i--;
        wholeLength -= movement.speed;
        gameMap.ctx.lineTo(gameMap.view.relativeX(x), gameMap.view.relativeY(y));
      }
    }

    gameMap.ctx.lineCap = 'round';
    gameMap.ctx.lineJoin = 'round';
    gameMap.ctx.strokeStyle = this.fillColor;
    gameMap.ctx.lineWidth = this.width;
    gameMap.ctx.stroke();
    gameMap.ctx.restore();

    // draw header
    gameMap.ctx.save();
    gameMap.ctx.translate(this.paintX, this.paintY);
    gameMap.ctx.rotate(this.angle);
    gameMap.ctx.drawImage(
      this.img,
      -this.paintWidth / 2,
      -this.paintHeight / 2,
      this.paintWidth,
      this.paintHeight,
    );
    gameMap.ctx.restore();
  }
}
