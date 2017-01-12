import { Commands, Command } from './commands';
import { Lander, tick } from './lander';
import * as seedrandom from 'seedrandom';
import { terrain, flag } from './terrain';
import { Vector, Geometry, landerFlameGeometry } from './geometry';
import { sky, render } from './render';
import { uniqueColor } from './color';
import UI from './ui';


export class GameState {
    public players: PlayerMsg[] = []
    public landers: Lander[] = []
    public commands: Commands = []
    public phase: GamePhase = GamePhase.INITIALIZING
    constructor(public readonly ctx: CanvasRenderingContext2D,
        public readonly rng: seedrandom.prng,
        public readonly fgTerrain: Geometry,
        public readonly bgTerrain: Geometry,
        public readonly flagPosition: Vector,
        public readonly skybox: ImageData,
        public readonly ws?: WebSocket) { }
}

/**
 * setup a new game
 */
export function setup(ctx: CanvasRenderingContext2D, seed: string) {
    let rng = seedrandom(seed);
    let ws = new WebSocket("ws://localhost:4711");
    ws.onmessage = function (this: WebSocket, msg: MessageEvent) {
        handleMessage(this, msg, state);
    };
    ws.onclose = function (this: WebSocket, ev: CloseEvent) {
        console.log('WebSocket connection closed: ' + ev.reason);
    };
    ws.onerror = console.error;
    let fgTerrain = terrain(10000, 350, rng, 9, 4);
    let bgTerrain = terrain(2500, 350, rng, 8, 3).map((p) => new Vector(p.x * 2, p.y + 50));
    let skybox = sky(3500, 800);
    let flagPosition = flag(fgTerrain, rng);
    let state = new GameState(ctx, rng, fgTerrain, bgTerrain, flagPosition, skybox, ws);
    return state;
}

/**
 * start a game and maintain the game loop
 */
export function start(state: GameState, ctx: CanvasRenderingContext2D) {
    state.phase = GamePhase.STARTED;
    send(state.ws, 'broadcast', '', { game: 'start' });
    let times: Times = {
        tick : [],
        render : [],
        ui: [],
        fps: []
    };
    let t: number[] = [];
    let loop = function(tickNo: number) {
        t[0] = performance.now();
        state.landers = state.landers.map((lander) => {
            let cmds = state.commands.filter(
                (c) => (!c.tick || c.tick <= tickNo) && c.token === lander.token);
            return tick(tickNo, cmds, lander, state.fgTerrain)
        });
        state.commands = state.commands.filter((c) => c.tick > tickNo);
        t[1] = performance.now();
        if (tickNo % 5 === 0) UI.update(state.landers, state.flagPosition);
        t[2] = performance.now();
        requestAnimationFrame((ts) => {
            t[5] = ts - t[3] || 0;
            t[3] = performance.now();
            let focus = new Vector(
                state.landers.reduce((p, c) => {
                    if (Math.abs(state.flagPosition.x - c.position.x) < Math.abs(state.flagPosition.x - p.position.x)) {
                        return c;
                    } else {
                        return p;
                    }
                }).position.x
                , 0);
            render(ctx, focus, state.landers, state.fgTerrain, state.bgTerrain, state.skybox, state.flagPosition);
            t[4] = performance.now();
        });
        updateTimes(times, t);
        if (tickNo % 5 === 0) UI.updateTimes(times);
        setTimeout(() => loop(++tickNo), 25);
    };
    loop(0);
}

function updateTimes(times: Times, t: number[]) {
    times.tick.push(t[1] - t[0]);
    times.ui.push(t[2] - t[1]);
    times.render.push(t[4] - t[3]);
    times.fps.push(1000 / t[5]);
    if (times.tick.length > TIMES_MAX) {
        Object.keys(times).map((k) => times[k].shift());
    }
}

function handleMessage(ws: WebSocket, msg: MessageEvent, state: GameState) {
    let data = JSON.parse(msg.data);
    if (state.phase === GamePhase.INITIALIZING && data.host === true) {
        state.phase = GamePhase.HOST_CONFIRMED;
    } else if (state.phase === GamePhase.HOST_CONFIRMED && isPlayerMsg(data)) {
        data.color = uniqueColor(data.name);
        state.players = state.players.concat(data);
        state.landers = state.landers.concat(new Lander(
            data.token,
            data.color,
            new Vector(1000, 300),
            new Vector(0, 0),
            0,
            "off",
            0,
            "off",
            1000));
        UI.addPlayer(data.token, data.name, data.color);
        send(state.ws, 'broadcast', '', {
            terrain: state.fgTerrain,
            flag: state.flagPosition
        });
    } else if (state.phase === GamePhase.STARTED && isCommandsMsg(data)) {
        state.commands = state.commands.concat(
            data.commands.map(
                cmd => new Command(data.token, cmd.engine, cmd.rotation, cmd.tick))
        );
    } else {
        console.error(`Dropped message in ${GamePhase[state.phase]}`, data);
    }
}

function send(ws: WebSocket, cmd: 'broadcast' | 'to' | 'disconnect', cval: string, data: any) {
    ws.send(`${cmd}:${cval}
${JSON.stringify(data)}`);
}

/// --- typeguards & interfaces ---
enum GamePhase {
    INITIALIZING,
    HOST_CONFIRMED,
    STARTED
}

interface PlayerMsg {
    token: string
    name: string
    color?: string
}

function isPlayerMsg(data: any): data is PlayerMsg {
    return (<PlayerMsg>data).token !== undefined &&
        (<PlayerMsg>data).name !== undefined;
}

interface CommandsMsg {
    token: string
    commands: Commands
}

function isCommandsMsg(data: any): data is CommandsMsg {
    return (<CommandsMsg>data).token !== undefined &&
        (<CommandsMsg>data).commands !== undefined;
}

interface HostConfirmMsg {
    host: boolean
}

export const TIMES_MAX = 100;
export type Times = {
    tick: number[]
    render: number[]
    ui: number[]
    fps: number[]
}
