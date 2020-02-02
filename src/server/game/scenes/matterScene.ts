import GameObjectGroup from '../matterObjects/matterGameObjectGroup'
import MatterGameObject from '../matterObjects/matterGameObject'
import Player from '../matterObjects/player'
import Star from '../matterObjects/star'
import { world } from '../../../client/config'

// PHYSICS_DEBUG
import Cursors from '../../../client/components/cursors'
import SyncManager from '../../managers/syncManager'
import RoomManager from '../../managers/roomManager'
import { SKINS } from '../../../constants'

interface MatterDebugObjs {
  socket?: Partial<SocketIOClient.Socket>
  cursors?: Cursors
  player?: Player
}

export default class MainScene extends Phaser.Scene {
  objects: MatterGameObject[] = []
  objectsToSync: any = {}
  debug: MatterDebugObjs = {}
  tick = 0
  level: number
  roomManager: RoomManager
  roomId: string

  constructor() {
    super({ key: 'MainScene', plugins: PHYSICS_DEBUG ? null : ['Clock'] })
    // see all scene plugins:
    // Phaser.Plugins.DefaultScene
    // https://github.com/photonstorm/phaser/blob/master/src/plugins/DefaultPlugins.js#L76
  }

  init() {
    try {
      //@ts-ignore
      const { level = 0, roomId, roomManager } = this.game.config.preBoot()
      this.level = level
      this.roomManager = roomManager
      this.roomId = roomId
    } catch (error) {
      if (!PHYSICS_DEBUG) console.error('onInit() failed!')
    }
  }

  create() {
    const Matter = Phaser.Physics.Matter.Matter
    const worldCenterX = (world.x + world.width) / 2
    const worldCenterY = (world.y + world.height) / 2

    // add and modify the world bounds
    let bounds: any = this.matter.world.setBounds(world.x, world.y, world.width, world.height)
    Object.keys(bounds.walls).forEach((key: any) => {
      let body = bounds.walls[key]
      Matter.Body.set(body, { friction: 0.05, frictionStatic: 0.05, frictionAir: 0.01 })
      // we do not need the top, so we set it to isSensor
      // if (key === 'top') Matter.Body.set(body, { isSensor: true })
    })

    // instantiate the GameObjectGroup
    let gameObjectGroup = new GameObjectGroup(this, this.objects)

    // this will stop the scene
    this.events.addListener('stopScene', () => {
      this.objects.forEach(obj => {
        this.matter.world.remove(obj.body)
      })
      this.roomManager.stats.removeTotalObjects(this.roomId)
      this.scene.stop()
      this.roomManager.stats.log(`Scene in roomId <b>${this.roomId}</b> has stopped!`)
    })

    // creates a new dude, when a new user connects
    this.events.addListener('createPlayer', (clientId: number, socketId: string) => {
      //let leftX = Phaser.Math.RND.integerInRange(world.x + 100, this.cameras.main.width / 2 - 640)
      //let rightX = Phaser.Math.RND.integerInRange(this.cameras.main.width / 2 + 640, world.x + world.width - 100)
      //let x = Math.random() > 0.5 ? leftX : rightX
      let x = worldCenterX
      let y = worldCenterY
      gameObjectGroup.add(x, y, SKINS.DUDE, { clientId, socketId })
    })

    // updates the position of a dude
    this.events.addListener('U' /* short for updateDude */, (res: any) => {
      let dudes: Player[] = this.objects.filter(obj => obj.clientId && obj.clientId === res.clientId) as any
      if (dudes[0]) {
        let b = res.updates
        let updates = {
          left: b === 1 || b === 5 ? true : false,
          right: b === 2 || b === 6 ? true : false,
          up: b === 4 || b === 6 || b === 5 ? true : false,
          none: b === 8 ? true : false
        }
        dudes[0].setUpdates(updates)
      }
    })

    // removes a dude
    this.events.addListener('removeDude', (clientId: number) => {
      let dudes = this.objects.filter(obj => obj.clientId && obj.clientId === clientId)
      dudes.forEach(dude => dude.kill())
    })

    // adds another box every 1.2 seconds
    /*this.time.addEvent({
      delay: 1200,
      loop: true,
      callback: () => {
        let x = Phaser.Math.RND.integerInRange(worldCenterX - 250 - 640, worldCenterX + 640 + 250)
        let y = 100
        gameObjectGroup.add(x, y, SKINS.BOX)
      }
    })*/

    // add the big star
    gameObjectGroup.add(worldCenterX, world.height - 320 - 100 - 115, SKINS.STAR, {
      category: 'big'
    })

    // add medium stars
    for (let x = worldCenterX - 128; x < worldCenterX + 128 + 64; x += 128)
      gameObjectGroup.add(x, world.height - 320 - 100, SKINS.STAR, { category: 'medium' })

    // add yellow stars
    for (let x = worldCenterX - 160 - 80; x < worldCenterX + 320 + 80; x += 160)
      gameObjectGroup.add(x, world.height - 320, SKINS.STAR)

    // create 4 boxes at server start
    gameObjectGroup.add(1280, 640, SKINS.BOX)
    gameObjectGroup.add(1280, 640, SKINS.BOX)
    gameObjectGroup.add(1280, 640, SKINS.BOX)
    gameObjectGroup.add(1280, 640, SKINS.BOX)

    // check for collisions
    const collisionEvent = (event: any) => {
      event.pairs.forEach((pair: any) => {
        const { bodyA, bodyB } = pair
        const labels: string[] = [bodyA.label, bodyB.label]

        // Dude hits star
        if (labels.includes('dude') && labels.includes('star')) {
          const starBody = bodyA.label === 'star' ? bodyA : bodyB
          const star = gameObjectGroup.getObjectById(starBody.id) as Star
          if (star) {
            star.kill()
            star.setReviveTimer()
          }
        }

        // Dude's sensor hits another body
        if (/Sensor/.test(bodyA.label) || /Sensor/.test(bodyB.label)) {
          const sensorBody = /Sensor/.test(bodyA.label) ? bodyA : bodyB
          const otherBody = /Sensor/.test(bodyA.label) ? bodyB : bodyA
          if (otherBody.isSensor) return

          const player = gameObjectGroup.getObjectById(sensorBody.parent.id) as Player
          if (player) {
            const sepPadding = otherBody.isStatic ? 0.1 : 2
            const sep = pair.separation - sepPadding

            if (sensorBody === player.sensors.left) {
              player.move.leftAllowed = !otherBody.isStatic
              player.touching.left = true
              if (pair.separation > sepPadding) {
                player.setTranslate(sep, 0)
              }
            } else if (sensorBody === player.sensors.right) {
              player.move.rightAllowed = !otherBody.isStatic
              player.touching.right = true 
              if (pair.separation > sepPadding) {
                player.setTranslate(-sep, 0)
              }
            } else if (sensorBody === player.sensors.top) {
              player.move.upAllowed = !otherBody.isStatic
              player.touching.top = true
              if (pair.separation > sepPadding) {
                player.setTranslate(0, sep)
              }
            } else if (sensorBody === player.sensors.bottom) {
              player.move.downAllowed = !otherBody.isStatic
              player.touching.bottom = true
              if (pair.separation > sepPadding) {
                player.setTranslate(0, -sep)
              }
            }
          } else {
            console.warn(`Failed to find Matter object with ID: ${sensorBody.parent.id}`)
          }
        }
      })
    }
    // https://itnext.io/modular-game-worlds-in-phaser-3-tilemaps-5-matter-physics-platformer-d14d1f614557
    this.matter.world.on('collisionstart', collisionEvent)
    this.matter.world.on('collisionactive', collisionEvent)

    if (PHYSICS_DEBUG) {
      this.add
        .text(24, 24, 'Physics Debugging Version\nMove with Arrow Keys', {
          fontSize: 36
        })
        .setScrollFactor(0)
        .setOrigin(0)
        .setAlpha(0.6)
      this.debug.socket = { emit: () => { } } as any // mock socket
      this.debug.cursors = new Cursors(this, this.debug.socket as SocketIOClient.Socket)
      this.debug.player = gameObjectGroup.add(
        worldCenterX,
        worldCenterY,
        SKINS.DUDE,
        { clientId: 55555, socketId: 'some-socket-id' }
      ) as Player
    } else {
      this.roomManager.stats.setTotalObjects(this.roomId, this.objects.length)
      this.time.addEvent({
        delay: 5000,
        startAt: 1,
        loop: true,
        callback: () => {
          this.roomManager.stats.setTotalObjects(this.roomId, this.objects.length)
        }
      })
    }
  }

  /** Sends the initial state to the client */
  getInitialState() {
    let objects: any[] = []
    SyncManager.prepareFromMatterGameObject(this.objects, objects)
    return SyncManager.encode(objects)
  }

  update(time: number, delta: number) {
    this.tick++
    if (this.tick > 1000000) this.tick = 0

    if (PHYSICS_DEBUG) {
      this.debug.cursors!.update()
      let cursorsDown = this.debug.cursors!.cursorsDown()
      let player: Player = this.debug.player!
      player.setUpdates(cursorsDown)
      player.update()
      this.cameras.main.setScroll(
        player.body.position.x - this.cameras.main.width / 2,
        player.body.position.y - this.cameras.main.height * 0.8
      )
    } else {
      this.objects.forEach(obj => {
        if (obj.body.position.y > world.height) obj.kill()

        obj.preUpdate()
        obj.update()

        const roundToEvenNumber = (number: number) => {
          try {
            return +(Math.round(number / 2) * 2).toFixed(0)
          } catch (e) {
            return 0
          }
        }

        // only send the object to the client if one of these properties have changed
        let dead = obj.dead != obj.prevDead
        let x = obj.body.position.x.toFixed(0) != obj.body.positionPrev.x.toFixed(0)
        let y = obj.body.position.y.toFixed(0) != obj.body.positionPrev.y.toFixed(0)
        let angle = roundToEvenNumber(obj.angle) != roundToEvenNumber(obj.prevAngle)
        let animation = obj.animation !== obj.prevAnimation
        if (dead || x || y || angle || animation) {
          let theObj: { [key: string]: any } = {
            // it always needs to have an id!
            id: obj.body.id,
            x: +obj.body.position.x.toFixed(0),
            y: +obj.body.position.y.toFixed(0),
            angle: angle ? roundToEvenNumber(obj.angle) : null,
            dead: dead ? obj.dead : null,
            animation: obj.animation ? obj.animation : null,
            clientId: obj.clientId ? obj.clientId : null,
            skin: obj.skin
          }
          let cleanObjectToSync = SyncManager.cleanObjectToSync(theObj)
          this.objectsToSync = SyncManager.mergeObjectToSync(cleanObjectToSync, this.objectsToSync)
        }

        // call the postUpdate function on all gameObjects
        obj.postUpdate()
      })

      let send: any[] = []
      Object.keys(this.objectsToSync).forEach(key => {
        send.push(this.objectsToSync[key])
        delete this.objectsToSync[key]
      })

      if (send.length > 0) {
        // send the objects to sync to all connected clients in this.roomId
        this.roomManager.ioNspGame
          .in(this.roomId)
          .emit('S' /* short for syncGame */, { O /* short for objects */: SyncManager.encode(send) })
      }
    }
  }
}
