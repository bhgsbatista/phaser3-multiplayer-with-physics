import { PlayerRoles } from '../game';
export default class Controls {
  private left = false
  private right = false
  private up = false
  private controls: Control[] = []
  private none = true
  private prevNone = true

  constructor(
    public scene: Phaser.Scene,
    public socket: SocketIOClient.Socket,
    public playerRole: PlayerRoles
  ){
    // add a second pointer
    scene.input.addPointer()

    const detectPointer = (gameObject: Control, down: boolean) => {
      if (gameObject.btn) {
        switch (gameObject.btn) {
          case 'left':
            this.left = down
            break
          case 'right':
            this.right = down
            break
          case 'up':
            this.up = down
            break
        }
      }
    }
    scene.input.on('gameobjectdown', (pointer: Phaser.Input.Pointer, gameObject: Control) =>
      detectPointer(gameObject, true)
    )
    scene.input.on('gameobjectup', (pointer: Phaser.Input.Pointer, gameObject: Control) =>
      detectPointer(gameObject, false)
    )

    this.controls = []

    switch(playerRole) {
      case PlayerRoles.ROWER:
        this.controls.push(
          new Control(scene, 0, 0, 'left').setRotation(-0.5 * Math.PI),
          new Control(scene, 0, 0, 'right').setRotation(0.5 * Math.PI)
        )
        break;
      case PlayerRoles.NAVIGATOR:
        this.controls.push(
          new Control(scene, 0, 0, 'up')
        )
        break;
      default:
        console.error("Unknown player role: " + playerRole)
    }

    this.resize()

    this.scene.events.on('update', this.update, this)
  }

  controlsDown() {
    return { left: this.left, right: this.right, up: this.up, none: this.none }
  }

  resize() {
    const SCALE = 1
    const controlsRadius = (192 / 2) * SCALE
    const w = this.scene.cameras.main.width - 10 - controlsRadius
    const h = this.scene.cameras.main.height - 10 - controlsRadius

    const positions: { x: number, y: number }[] = new Array(this.controls.length)

    switch(this.playerRole) {
      case PlayerRoles.ROWER:
        positions[0] = { x: controlsRadius + 10, y: h }
        positions[1] = { x: w, y: h }
        break;
      case PlayerRoles.NAVIGATOR:
        console.warn("PlayerRoles.NAVIGATOR not yet implemented")
        break;
    }

    this.controls.forEach((ctl, i) => {
      ctl.setPosition(positions[i].x, positions[i].y)
      ctl.setScale(SCALE)
    })
  }

  update() {
    this.none = this.left || this.right || this.up ? false : true

    if (!this.none || this.none !== this.prevNone) {
      let total = 0
      if (this.left) total += 1
      if (this.right) total += 2
      if (this.up) total += 4
      if (this.none) total += 8
      this.socket.emit('U' /* short for updateDude */, total)
    }

    this.prevNone = this.none
  }
}

class Control extends Phaser.GameObjects.Image {
  constructor(scene: Phaser.Scene, x: number, y: number, public btn: string) {
    super(scene, x, y, 'controls')
    scene.add.existing(this)

    this.setInteractive()
      .setScrollFactor(0)
      .setAlpha(0.5)
      .setDepth(2)

    if (!scene.sys.game.device.input.touch) this.setAlpha(0)
  }
}
