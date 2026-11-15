import { describe, expect, it } from 'vitest';
import { createShape } from '../dice/shapes.js';
import { createBody } from './body.js';
import { SLOP, detectContacts } from './collision.js';
import { FIXED_DT, createWorld } from './world.js';
import * as quat from '../math/quat.js';
import * as vec3 from '../math/vec3.js';

const R = 0.01;
const H = R / Math.sqrt(3);
const BASE_Z = 1;

const near = (actual, expected, eps = 1e-9) =>
  expect(Math.abs(actual - expected)).toBeLessThan(eps);

const nearRel = (actual, expected, eps = 1e-9) =>
  expect(Math.abs(actual - expected)).toBeLessThan(eps * Math.abs(expected));

const cube = (radius = R) => createShape('d6', radius);

const worldWith = (bodies, box = { W: 0.1, H: 0.1, D: 0.1 }) => ({ bodies, box, contacts: [] });

const detect = (bodies, box, dt = FIXED_DT) => {
  const world = worldWith(bodies, box);
  detectContacts(world, dt);
  return world.contacts;
};

const die = (candidate) => candidate.surface === 'die';

const unit = (vector) => vec3.normalize(new Float64Array(3), vector);

const faceAligned = (body, normal) =>
  body.shape.faces.some((face) => {
    const worldNormal = vec3.transformQuat(new Float64Array(3), face.normal, body.orientation);
    return Math.abs(vec3.dot(worldNormal, normal)) > 0.999;
  });

describe('die vs die SAT', () => {
  it('finds no contact between two separated cubes', () => {
    const a = createBody(cube(), { position: [0, 0, BASE_Z] });
    const b = createBody(cube(), { position: [0, 0, BASE_Z + 3 * H] });
    expect(detect([a, b]).filter(die)).toEqual([]);
  });

  it('gives four clipped points for two overlapping face to face cubes', () => {
    const small = cube(0.8 * R);
    const a = createBody(cube(), { position: [0, 0, BASE_Z] });
    const b = createBody(small, { position: [0, 0, BASE_Z + 1.64 * H] });
    const contacts = detect([a, b]).filter(die);
    expect(contacts).toHaveLength(4);
    for (const contact of contacts) {
      near(contact.normal[2], -1);
      near(contact.depth, 0.16 * H);
    }
  });

  // Two generically oriented equal cubes posed so that one edge of each cube is the
  // closest feature pair. The position is the analytic edge edge pose for the rotation below.
  it('gives one edge contact for two crossing cubes', () => {
    const orientation = quat.setAxisAngle(quat.create(), [0, 0, 1], Math.PI / 6);
    quat.multiply(orientation, orientation, quat.setAxisAngle(quat.create(), [1, 0, 0], Math.PI / 6));
    quat.multiply(orientation, orientation, quat.setAxisAngle(quat.create(), [0, 1, 0], Math.PI / 5));
    const a = createBody(cube(), { position: [0, 0, BASE_Z] });
    const b = createBody(cube(), {
      position: [0.0016066415662969145, 0.009601413144729818, BASE_Z + 0.012476879380707295],
      orientation,
    });
    const contacts = detect([a, b]).filter(die);
    expect(contacts).toHaveLength(1);
    const expected = unit(
      vec3.negate(
        new Float64Array(3),
        vec3.cross(
          new Float64Array(3),
          [1, 0, 0],
          vec3.transformQuat(new Float64Array(3), cube().edgeDirs[0], orientation),
        ),
      ),
    );
    nearRel(contacts[0].depth, 0.05 * H);
    for (let i = 0; i < 3; i += 1) near(contacts[0].normal[i], expected[i], 1e-12);
    expect(faceAligned(a, contacts[0].normal)).toBe(false);
    expect(faceAligned(b, contacts[0].normal)).toBe(false);
  });

  it('finds no contact between two well separated dice', () => {
    const a = createBody(cube(), { position: [0, 0, BASE_Z] });
    const b = createBody(cube(), { position: [0.05, 0, BASE_Z] });
    expect(detect([a, b]).filter(die)).toEqual([]);
  });

  it('points the normal from b toward a for overlapping dice', () => {
    const a = createBody(cube(), { position: [0, 0, BASE_Z] });
    const b = createBody(cube(), { position: [0, 0, BASE_Z + 0.01] });
    const contacts = detect([a, b]).filter(die);
    expect(contacts.length).toBeGreaterThan(0);
    for (const contact of contacts) {
      near(contact.normal[2], -1);
      nearRel(contact.depth, 2 * H - 0.01);
      expect(vec3.dot(contact.normal, vec3.sub(new Float64Array(3), a.position, b.position))).toBeGreaterThan(0);
    }
  });
});

describe('die vs box', () => {
  it('reports a penetrating vertex with the inward floor normal and positive depth', () => {
    const body = createBody(cube(), { position: [0, 0, 0] });
    const floors = detect([body]).filter((contact) => contact.surface === 'floor');
    expect(floors.length).toBeGreaterThan(0);
    for (const contact of floors) {
      near(contact.normal[2], 1);
      nearRel(contact.depth, H);
    }
  });

  it('reports a gap inside the speculative margin as negative depth', () => {
    const body = createBody(cube(), { position: [0, 0, H + SLOP / 2] });
    const floors = detect([body]).filter((contact) => contact.surface === 'floor');
    expect(floors).toHaveLength(4);
    for (const contact of floors) nearRel(contact.depth, -SLOP / 2);
  });

  it('generates the speculative contact that stops a fast die from tunnelling', () => {
    const fast = createBody(cube(), { position: [0, 0, H + 0.01] });
    vec3.set(fast.linearVelocity, 0, 0, -100);
    const fastFloor = detect([fast]).filter((contact) => contact.surface === 'floor');
    expect(fastFloor.length).toBeGreaterThan(0);
    const leading = Math.max(...fastFloor.map((contact) => contact.depth));
    nearRel(leading, -0.01);

    const slow = createBody(cube(), { position: [0, 0, H + 0.01] });
    vec3.set(slow.linearVelocity, 0, 0, -0.1);
    expect(detect([slow]).filter((contact) => contact.surface === 'floor')).toEqual([]);
  });

  it('rests a die on its lowest face only', () => {
    const body = createBody(cube(), { position: [0, 0, H] });
    const contacts = detect([body]);
    expect(contacts).toHaveLength(4);
    for (const contact of contacts) {
      expect(contact.surface).toBe('floor');
      near(contact.normal[2], 1);
      near(contact.point[2], 0, 1e-12);
      near(contact.depth, 0);
    }
  });
});

describe('world wiring', () => {
  it('stores the fresh contacts of each step', () => {
    const world = createWorld({ W: 0.1, H: 0.1, D: 0.1 });
    world.addBody(createBody(cube(), { position: [0, 0, H] }));
    world.step(FIXED_DT);
    expect(world.contacts).toHaveLength(4);
  });
});
