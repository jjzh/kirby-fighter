import Phaser from 'phaser';
import { type InputState, NULL_INPUT } from '@simulation/types';

// -- Joystick layout --
const JOYSTICK_X = 170;
const JOYSTICK_Y = 530;
const JOYSTICK_DEADZONE = 25;
const JOYSTICK_MAX_RADIUS = 90;
const JOYSTICK_ZONE_RIGHT = 500; // left portion of screen is joystick zone

// -- Button layout (fan from primary in bottom-right) --
const PRIMARY_RADIUS = 56;
const SECONDARY_RADIUS = 38;
const FAN_DISTANCE = 120;

const PRIMARY_X = 1110;
const PRIMARY_Y = 580;

const BUTTON_ALPHA = 0.3;
const BUTTON_PRESSED_ALPHA = 0.6;
const UI_DEPTH = 1000;

interface ButtonDef {
  key: keyof InputState;
  x: number;
  y: number;
  radius: number;
  label: string;
  color: number;
  graphic?: Phaser.GameObjects.Arc;
  pressed: boolean;
}

export class TouchInput {
  private scene: Phaser.Scene;

  // Joystick visuals
  private joystickBase: Phaser.GameObjects.Arc;
  private joystickThumb: Phaser.GameObjects.Arc;
  private uiObjects: Phaser.GameObjects.GameObject[] = [];

  // Buttons: fan layout per spec
  //   Light (primary, large): bottom-right, always under thumb
  //   Suck:  9 o'clock (directly left)
  //   Jump:  10–11 o'clock (upper-left)
  //   Heavy: 12 o'clock (directly above)
  private buttons: ButtonDef[] = [
    { key: 'light', x: PRIMARY_X, y: PRIMARY_Y, radius: PRIMARY_RADIUS,
      label: 'A', color: 0xFF6B6B, pressed: false },
    { key: 'suck', x: PRIMARY_X - FAN_DISTANCE, y: PRIMARY_Y,
      radius: SECONDARY_RADIUS, label: 'S', color: 0x6BB5FF, pressed: false },
    { key: 'jump', x: PRIMARY_X - Math.round(FAN_DISTANCE * Math.cos(Math.PI / 4)),
      y: PRIMARY_Y - Math.round(FAN_DISTANCE * Math.sin(Math.PI / 4)),
      radius: SECONDARY_RADIUS, label: 'J', color: 0x6BFF6B, pressed: false },
    { key: 'heavy', x: PRIMARY_X, y: PRIMARY_Y - FAN_DISTANCE,
      radius: SECONDARY_RADIUS, label: 'H', color: 0xFFBB6B, pressed: false },
  ];

  constructor(scene: Phaser.Scene) {
    this.scene = scene;

    // Enable multitouch (Phaser default is 2 pointers; we need more)
    scene.input.addPointer(3);

    // -- Joystick visuals --
    this.joystickBase = scene.add.circle(JOYSTICK_X, JOYSTICK_Y, JOYSTICK_MAX_RADIUS, 0xFFFFFF, 0.12);
    this.joystickBase.setDepth(UI_DEPTH).setStrokeStyle(2, 0xFFFFFF, 0.25);

    this.joystickThumb = scene.add.circle(JOYSTICK_X, JOYSTICK_Y, 32, 0xFFFFFF, 0.35);
    this.joystickThumb.setDepth(UI_DEPTH + 1);

    this.uiObjects.push(this.joystickBase, this.joystickThumb);

    // -- Button visuals --
    for (const btn of this.buttons) {
      btn.graphic = scene.add.circle(btn.x, btn.y, btn.radius, btn.color, BUTTON_ALPHA);
      btn.graphic.setDepth(UI_DEPTH).setStrokeStyle(2, 0xFFFFFF, 0.25);

      const label = scene.add.text(btn.x, btn.y, btn.label, {
        fontSize: btn.radius > 40 ? '22px' : '16px',
        color: '#FFFFFF',
        fontFamily: 'monospace',
      }).setOrigin(0.5).setDepth(UI_DEPTH + 1).setAlpha(0.6);

      this.uiObjects.push(btn.graphic, label);
    }
  }

  /** Poll all active pointers and return the current InputState for this player. */
  getInput(): InputState {
    const state: InputState = { ...NULL_INPUT };

    // Reset pressed flags
    for (const btn of this.buttons) {
      btn.pressed = false;
    }

    // Collect all active pointers
    const pointers = this.scene.input.manager.pointers;
    let joystickPointer: Phaser.Input.Pointer | null = null;

    for (const pointer of pointers) {
      if (!pointer.isDown) continue;

      const px = pointer.x;
      const py = pointer.y;

      // Left side → joystick
      if (px < JOYSTICK_ZONE_RIGHT) {
        joystickPointer = pointer;
        continue;
      }

      // Right side → check buttons (generous 1.4× hit area)
      for (const btn of this.buttons) {
        const dx = px - btn.x;
        const dy = py - btn.y;
        if (dx * dx + dy * dy < (btn.radius * 1.4) ** 2) {
          btn.pressed = true;
          state[btn.key] = true;
        }
      }
    }

    // -- Process joystick --
    if (joystickPointer) {
      const dx = joystickPointer.x - JOYSTICK_X;
      const dy = joystickPointer.y - JOYSTICK_Y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > JOYSTICK_DEADZONE) {
        const clamped = Math.min(dist, JOYSTICK_MAX_RADIUS);
        const nx = (dx / dist) * clamped;
        const ny = (dy / dist) * clamped;
        this.joystickThumb.setPosition(JOYSTICK_X + nx, JOYSTICK_Y + ny);

        // Set directional booleans (45° threshold per axis)
        if (Math.abs(dx) > Math.abs(dy) * 0.5) {
          state.left = dx < 0;
          state.right = dx > 0;
        }
        if (Math.abs(dy) > Math.abs(dx) * 0.5) {
          state.up = dy < 0;
          state.down = dy > 0;
        }
      } else {
        this.joystickThumb.setPosition(JOYSTICK_X, JOYSTICK_Y);
      }
    } else {
      this.joystickThumb.setPosition(JOYSTICK_X, JOYSTICK_Y);
    }

    // -- Update button visuals --
    for (const btn of this.buttons) {
      btn.graphic?.setFillStyle(btn.color, btn.pressed ? BUTTON_PRESSED_ALPHA : BUTTON_ALPHA);
    }

    return state;
  }

  /** All UI game objects, for camera assignment. */
  getGameObjects(): Phaser.GameObjects.GameObject[] {
    return this.uiObjects;
  }
}
