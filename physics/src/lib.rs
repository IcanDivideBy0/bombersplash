#![feature(use_extern_macros)]

extern crate nalgebra as na;
extern crate ncollide2d;
extern crate nphysics2d;
extern crate serde;
#[macro_use]
extern crate serde_derive;
extern crate wasm_bindgen;

use na::{Isometry2, Vector2};
use ncollide2d::shape::{Ball, Cuboid, ShapeHandle};
use nphysics2d::joint::{CartesianConstraint, ConstraintHandle};
use nphysics2d::math::Velocity;
use nphysics2d::object::{BodyHandle, ColliderHandle, Material};
use nphysics2d::volumetric::Volumetric;
use nphysics2d::world::World;
use std::collections::HashMap;
use wasm_bindgen::prelude::*;

const COLLIDER_MARGIN: f32 = 0.01;

/**
 * Js shared types
 */

#[derive(Serialize, Deserialize)]
pub struct JsVec {
    x: f32,
    y: f32,
}

#[derive(Serialize, Deserialize)]
pub struct JsWall {
    pos: JsVec,
    rot: f32,
    w: f32,
    h: f32,
}

#[derive(Serialize, Deserialize)]
pub struct JsPlayer {
    id: String,
    team: String,
    pos: JsVec,
    rot: f32,
    vel: JsVec,
    r: f32,
}

#[derive(Serialize, Deserialize)]
pub struct JsBomb {
    id: String,
    team: String,
    pos: JsVec,
    rot: f32,
    vel: JsVec,
    r: f32,
}

#[derive(Serialize, Deserialize)]
pub struct JsWorld {
    players: Vec<JsPlayer>,
    bombs: Vec<JsBomb>,
}

/**
 * Internal types
 */

struct Player {
    id: String,
    team: String,
    radius: f32,

    // Physics handles
    body: BodyHandle,
    collider: ColliderHandle,
    constraint: ConstraintHandle,
}

struct Bomb {
    id: String,
    team: String,
    radius: f32,

    // Physics handles
    body: BodyHandle,
    collider: ColliderHandle,
}

/**
 * The physic world
 */

#[wasm_bindgen]
pub struct BombersplashWorld {
    world: World<f32>,
    players: HashMap<String, Player>,
    bombs: HashMap<String, Bomb>,
}

#[wasm_bindgen]
impl BombersplashWorld {
    #[wasm_bindgen(constructor)]
    pub fn new() -> BombersplashWorld {
        let mut world = World::new();
        world.set_gravity(Vector2::new(0.0, 0.0));
        world.set_timestep(1.0 / 60.0);

        BombersplashWorld {
            world,
            players: HashMap::new(),
            bombs: HashMap::new(),
        }
    }

    pub fn step(&mut self, timestep: f32) {
        self.world.set_timestep(timestep);
        self.world.step();
    }

    #[wasm_bindgen(js_name = getWorldState)]
    pub fn get_world_state(&self) -> JsValue {
        let mut players = Vec::<JsPlayer>::new();
        let mut bombs = Vec::<JsBomb>::new();

        for (_, player) in self.players.iter() {
            let body = self.world.rigid_body(player.body).unwrap();
            let position = body.position();

            let pos: [f32; 2] = position.translation.vector.into();
            let rot: f32 = position.rotation.angle();
            let vel = body.velocity().as_slice();

            players.push(JsPlayer {
                id: player.id.to_owned(),
                team: player.team.to_owned(),
                pos: JsVec {
                    x: pos[0],
                    y: -pos[1],
                },
                rot: -rot,
                vel: JsVec {
                    x: vel[0],
                    y: -vel[1],
                },
                r: player.radius,
            });
        }

        for (_, bomb) in self.bombs.iter() {
            let body = self.world.rigid_body(bomb.body).unwrap();
            let position = body.position();

            let pos: [f32; 2] = position.translation.vector.into();
            let rot: f32 = position.rotation.angle();
            let vel = body.velocity().as_slice();

            bombs.push(JsBomb {
                id: bomb.id.to_owned(),
                team: bomb.team.to_owned(),
                pos: JsVec {
                    x: pos[0],
                    y: -pos[1],
                },
                rot: -rot,
                vel: JsVec {
                    x: vel[0],
                    y: -vel[1],
                },
                r: bomb.radius,
            });
        }

        let world = JsWorld { players, bombs };
        JsValue::from_serde(&world).unwrap()
    }

    #[wasm_bindgen(js_name = setWorldState)]
    pub fn set_world_state(&mut self, js_world: &JsValue) {
        let world: JsWorld = js_world.into_serde().unwrap();

        for (_, player) in self.players.iter() {
            self.world.remove_constraint(player.constraint);
            self.world.remove_colliders(&[player.collider]);
            self.world.remove_bodies(&[player.body]);
        }
        self.players.clear();

        for (_, bomb) in self.bombs.iter() {
            self.world.remove_colliders(&[bomb.collider]);
            self.world.remove_bodies(&[bomb.body]);
        }
        self.bombs.clear();

        for player in world.players {
            self.add_js_player(player);
        }

        for bomb in world.bombs {
            self.add_js_bomb(bomb);
        }
    }

    /**
     * Walls
     */

    #[wasm_bindgen(js_name = addWall)]
    pub fn add_wall(&mut self, js_value: &JsValue) {
        let js_wall: JsWall = js_value.into_serde().unwrap();
        self.add_js_wall(js_wall)
    }

    fn add_js_wall(&mut self, js_wall: JsWall) {
        let shape = ShapeHandle::new(Cuboid::new(Vector2::new(
            (js_wall.w / 2.0) - COLLIDER_MARGIN,
            (js_wall.h / 2.0) - COLLIDER_MARGIN,
        )));
        let pos = Isometry2::new(Vector2::new(js_wall.pos.x, -js_wall.pos.y), -js_wall.rot);

        self.world.add_collider(
            COLLIDER_MARGIN,
            shape,
            BodyHandle::ground(),
            pos,
            Material::default(),
        );
    }

    /**
     * Player functions
     */

    #[wasm_bindgen(js_name = addPlayer)]
    pub fn add_player(&mut self, js_value: &JsValue) {
        let js_player: JsPlayer = js_value.into_serde().unwrap();
        self.add_js_player(js_player)
    }

    fn add_js_player(&mut self, js_player: JsPlayer) {
        let shape_handle = ShapeHandle::new(Ball::new(js_player.r));

        let pos = Vector2::new(js_player.pos.x, -js_player.pos.y);
        let inertia = shape_handle.inertia(1.0);
        let center_of_mass = shape_handle.center_of_mass();
        let body_handle =
            self.world
                .add_rigid_body(Isometry2::new(pos, -js_player.rot), inertia, center_of_mass);

        {
            let body = self.world.rigid_body_mut(body_handle).unwrap();
            body.set_velocity(Velocity::linear(js_player.vel.x, -js_player.vel.y));
        }

        let collider_handle = self.world.add_collider(
            COLLIDER_MARGIN,
            shape_handle,
            body_handle,
            Isometry2::identity(),
            Material::default(),
        );

        let constraint = CartesianConstraint::new(
            BodyHandle::ground(),
            body_handle,
            Isometry2::identity(),
            Isometry2::identity(),
        );

        let constraint_handle = self.world.add_constraint(constraint);

        let player = Player {
            id: js_player.id.to_owned(),
            team: js_player.team.to_owned(),
            radius: js_player.r,

            body: body_handle,
            collider: collider_handle,
            constraint: constraint_handle,
        };

        self.players.insert(js_player.id.to_owned(), player);
    }

    #[wasm_bindgen(js_name = removePlayer)]
    pub fn remove_player(&mut self, id: &str) {
        {
            let player = self.players.get(id).unwrap();

            self.world.remove_constraint(player.constraint);
            self.world.remove_colliders(&[player.collider]);
            self.world.remove_bodies(&[player.body]);
        }

        self.players.remove(id);
    }

    #[wasm_bindgen(js_name = replacePlayer)]
    pub fn replace_player(&mut self, js_value: &JsValue) {
        let js_player: JsPlayer = js_value.into_serde().unwrap();
        self.remove_player(js_player.id.as_str());
        self.add_js_player(js_player);
    }

    #[wasm_bindgen(js_name = setPlayerVelocity)]
    pub fn set_player_velocity(&mut self, id: &str, js_value: &JsValue) {
        let vel: JsVec = js_value.into_serde().unwrap();

        let handle = self.players.get(id).unwrap().body;
        let body = self.world.rigid_body_mut(handle).unwrap();

        if !body.is_active() && (vel.x != 0.0 || vel.y != 0.0) {
            body.activate();
        }

        body.set_velocity(Velocity::linear(vel.x, -vel.y));
    }

    #[wasm_bindgen(js_name = getPlayerState)]
    pub fn get_player_state(&self, id: &str) -> JsValue {
        let player = self.players.get(id).unwrap();
        let body = self.world.rigid_body(player.body).unwrap();
        let position = body.position();

        let pos: [f32; 2] = position.translation.vector.into();
        let rot: f32 = position.rotation.angle();
        let vel = body.velocity().as_slice();

        let js_player = JsPlayer {
            id: player.id.to_owned(),
            team: player.team.to_owned(),
            pos: JsVec {
                x: pos[0],
                y: -pos[1],
            },
            rot: -rot,
            vel: JsVec {
                x: vel[0],
                y: -vel[1],
            },
            r: player.radius,
        };
        JsValue::from_serde(&js_player).unwrap()
    }

    /**
     * Bomb functions
     */

    #[wasm_bindgen(js_name = addBomb)]
    pub fn add_bomb(&mut self, js_value: &JsValue) {
        let js_bomb: JsBomb = js_value.into_serde().unwrap();
        self.add_js_bomb(js_bomb)
    }

    fn add_js_bomb(&mut self, js_bomb: JsBomb) {
        let shape_handle = ShapeHandle::new(Ball::new(js_bomb.r));

        let pos = Vector2::new(js_bomb.pos.x, -js_bomb.pos.y);
        let inertia = shape_handle.inertia(1.0);
        let center_of_mass = shape_handle.center_of_mass();
        let body_handle =
            self.world
                .add_rigid_body(Isometry2::new(pos, -js_bomb.rot), inertia, center_of_mass);

        {
            let body = self.world.rigid_body_mut(body_handle).unwrap();
            body.set_velocity(Velocity::linear(js_bomb.vel.x, -js_bomb.vel.y));
        }

        let collider_handle = self.world.add_collider(
            COLLIDER_MARGIN,
            shape_handle,
            body_handle,
            Isometry2::identity(),
            Material::default(),
        );

        let bomb = Bomb {
            id: js_bomb.id.to_owned(),
            team: js_bomb.team.to_owned(),
            radius: js_bomb.r,

            body: body_handle,
            collider: collider_handle,
        };

        self.bombs.insert(js_bomb.id.to_owned(), bomb);
    }

    #[wasm_bindgen(js_name = removeBomb)]
    pub fn remove_bomb(&mut self, id: &str) {
        {
            let bomb = self.bombs.get(id).unwrap();

            self.world.remove_colliders(&[bomb.collider]);
            self.world.remove_bodies(&[bomb.body]);
        }

        self.bombs.remove(id);
    }

    #[wasm_bindgen(js_name = getBombState)]
    pub fn get_bomb_state(&self, id: &str) -> JsValue {
        let bomb = self.bombs.get(id).unwrap();
        let body = self.world.rigid_body(bomb.body).unwrap();
        let position = body.position();

        let pos: [f32; 2] = position.translation.vector.into();
        let rot: f32 = position.rotation.angle();
        let vel = body.velocity().as_slice();

        let js_bomb = JsBomb {
            id: bomb.id.to_owned(),
            team: bomb.team.to_owned(),
            pos: JsVec {
                x: pos[0],
                y: -pos[1],
            },
            rot: -rot,
            vel: JsVec {
                x: vel[0],
                y: -vel[1],
            },
            r: bomb.radius,
        };
        JsValue::from_serde(&js_bomb).unwrap()
    }
}
