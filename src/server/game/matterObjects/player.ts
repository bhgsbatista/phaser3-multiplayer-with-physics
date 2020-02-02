import MatterGameObject from './matterGameObject'
import { SKINS } from '../../../constants'
import { BodyType } from 'matter'

interface InputUpdates {
  left?: boolean
  right?: boolean
  up?: boolean
  none?: boolean
}

export default class Player extends MatterGameObject {
  maxVelocity = {
    x: 1,
    y: 1,
  }
  width = 32
  height = 48

  shouldUpdate = true

  sensors: {
    left: BodyType
    right: BodyType
    top: BodyType
    bottom: BodyType
  }
  mainBody: BodyType
  translateX = 0
  translateY = 0

  jumpLocked = false

  move = {
    leftAllowed: true,
    rightAllowed: true,
    upAllowed: true,
    downAllowed: true
  }
  touching = {
    left: false,
    right: false,
    top: false,
    bottom: false
  }
  updates: InputUpdates = {}

  forwardVec = new Phaser.Geom.Point(0, -1);

  constructor(scene: Phaser.Scene, x: number, y: number, public clientId: number, public socketId: string) {
    super(scene, SKINS.DUDE)

    let h = this.height
    let w = this.width - 4

    console.log('clientId', clientId)

    this.mainBody = this.Matter.Bodies.rectangle(x, y, w, h, {
      density: 0.001,
      friction: 0.1,
      frictionStatic: 0.1,
      label: 'dude',
      chamfer: { radius: 10 }
    })
    this.sensors = {
      left: this.Matter.Bodies.rectangle(x - w / 2 - 4 / 2, y + 0, 4, h * 0.9, { isSensor: true }),
      right: this.Matter.Bodies.rectangle(x + w / 2 + 4 / 2, y + 0, 4, h * 0.9, { isSensor: true }),
      top: this.Matter.Bodies.rectangle(x, y - h / 2 + 2 / 2, w * 0.75, 4, { isSensor: true }),
      bottom: this.Matter.Bodies.rectangle(x, y + h / 2 + 2 / 2, w * 0.75, 4, { isSensor: true }),
    }
    this.addBodies([this.mainBody, this.sensors.left, this.sensors.right, this.sensors.top, this.sensors.bottom])

    this.setSensorLabel()

    this.Matter.Body.setInertia(this.body, Infinity) // setFixedRotation
  }

  setTranslate(x: number, y: number) {
    this.translateX = x
    this.translateY = y
    this.translate();
  }

  translate() {
    if (this.translateX !== 0 || this.translateY !== 0) {
      this.Matter.Body.setPosition(this.body, {
        x: this.body.position.x + this.translateX,
        y: this.body.position.y + this.translateY
      })
      this.translateX = 0
      this.translateY = 0
    }
  }

  setSensorLabel() {
    this.sensors.left.label = `dudeLeftSensor_${this.clientId}`
    this.sensors.right.label = `dudeRightSensor_${this.clientId}`
    this.sensors.top.label = `dudeTopSensor_${this.clientId}`
    this.sensors.bottom.label = `dudeBottomSensor_${this.clientId}`
  }

  revive(x: number, y: number, clientId: number, socketId: string) {
    super.revive(x, y)
    this.clientId = clientId
    this.socketId = socketId
    this.setSensorLabel()
  }

  lockJump() {
    this.jumpLocked = true
    this.scene.time.addEvent({
      delay: 250,
      callback: () => (this.jumpLocked = false)
    })
  }

  setUpdates(updates: InputUpdates) {
    this.shouldUpdate = true
    this.updates = updates
  }

  update(force = false) {
    this.animation = 'idle'

    if (!force && !this.shouldUpdate) return

    const updates = this.updates
    const move = this.move

    // const x = updates.left && move.leftAllowed ? -0.01 : updates.right && move.rightAllowed ? 0.01 : 0
    // const y = updates.up && move.upAllowed ? -0.01 : 0

    const left = updates.left && move.leftAllowed
    const right = updates.right && move.rightAllowed
    console.log(`left=${left}, right=${right}`)

    //if (y !== 0) this.lockJump()

    // We use setVelocity to jump and applyForce to move right and left

    // Jump
    //if (y !== 0) this.Matter.Body.setVelocity(this.body, { x: this.body.velocity.x, y })

    // Move
    this.Matter.Body.setAngularVelocity(this.body, left && right ? 0 : left ? -0.005 : right ? 0.005 : 0);

    if (left && right && move.upAllowed) {
      const result = Phaser.Math.RotateAround(Phaser.Geom.Point.Clone(this.forwardVec), 0, 0, this.body.angle);
      this.Matter.Body.applyForce(this.body, this.body.position, { x: result.x * 0.01, y: result.y * 0.01 })
    }

    // enforce max velocity
    const newVelocity = { ...this.body.velocity }

    const maxVelocityX = this.body.velocity.x > this.maxVelocity.x ? this.maxVelocity.x : this.body.velocity.x < -this.maxVelocity.x ? -this.maxVelocity.x : null
    if (maxVelocityX) {
      newVelocity.x = this.maxVelocity.x * maxVelocityX
    }
    const maxVelocityY = this.body.velocity.y > this.maxVelocity.y ? this.maxVelocity.y : this.body.velocity.y < -this.maxVelocity.y ? -this.body.velocity.y : null
    if (maxVelocityY) {
      newVelocity.y = this.maxVelocity.y * maxVelocityY
    }

    this.Matter.Body.setVelocity(this.body, newVelocity)

    // set velocity X to zero
    if (!updates.left && !updates.right) {
      this.Matter.Body.setVelocity(this.body, { x: this.body.velocity.x * 0.5, y: this.body.velocity.y * 0.5 })
    }

    this.animation = this.body.velocity.x >= 0.5 ? 'right' : this.body.velocity.x <= -0.5 ? 'left' : 'idle'

    this.translate()

    this.touching.left = false
    this.touching.right = false
    this.touching.top = false
    this.touching.bottom = false

    this.move.leftAllowed = true
    this.move.rightAllowed = true
    this.move.upAllowed = true
    this.move.downAllowed = true

    this.updates = {}
    this.shouldUpdate = false
  }
}
