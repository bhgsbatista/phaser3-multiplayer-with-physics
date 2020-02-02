import { world } from '../../../client/config'
import Box from '../arcadeObjects/box'
import Player from '../arcadeObjects/player'
import Cursors from '../../../client/components/cursors'
import Star from '../arcadeObjects/star'
import Mummy from '../arcadeObjects/mummy'
import Map from '../arcadeObjects/map'
import SyncManager from '../../managers/syncManager'
import RoomManager from '../../managers/roomManager'
import { SKINS } from '../../../constants'

export default class MainScene extends Phaser.Scene {
  id = 0
  playerGroup: Phaser.GameObjects.Group
  boxGroup: Phaser.GameObjects.Group
  mummyGroup: Phaser.GameObjects.Group
  star: Star
  debug: any = {}
  level = 0
  map: Map
  objectsToSync: any = {}
  tick = 0
  roomManager: RoomManager
  roomId: string

  constructor() {
    // @ts-ignore
    super({ key: 'MainScene', plugins: PHYSICS_DEBUG ? null : ['Clock'], active: false, cameras: null })
    // see all scene plugins:
    // Phaser.Plugins.DefaultScene
    // https://github.com/photonstorm/phaser/blob/master/src/plugins/DefaultPlugins.js#L76
  }

  /** Create a new object id */
  newId() {
    return this.id++
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
    // this will stop the scene
    this.events.addListener('stopScene', () => {
      this.roomManager.stats.removeTotalObjects(this.roomId)
      this.scene.stop()
      this.roomManager.stats.log(`Scene in roomId <b>${this.roomId}</b> has stopped!`)
    })

    this.physics.world.setBounds(world.x, world.y, world.width, world.height)
    this.playerGroup = this.add.group()
    this.boxGroup = this.add.group()
    this.mummyGroup = this.add.group()
    this.map = new Map(this, world, this.level)
    const level = this.map.getLevel()

    // generate the level
    level.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) {
        const xx = x * this.map.tileSize + this.map.margin.x
        const yy = y * this.map.tileSize + this.map.margin.y
        if (row[x] === 'X') this.boxGroup.add(new Box(this, this.newId(), xx, yy))
        if (row[x] === 'G') this.star = new Star(this, this.newId(), xx, yy)
        if (row[x] === 'M') this.mummyGroup.add(new Mummy(this, this.newId(), xx, yy))
      }
    })

    if (PHYSICS_DEBUG) {
      this.add
        .text(24, 24, 'Physics Debugging Version\nMove with Arrow Keys', {
          fontSize: 36
        })
        .setScrollFactor(0)
        .setOrigin(0)
        .setAlpha(0.6)
      // mock socket
      this.debug.socket = { emit: () => {} }
      this.debug.cursors = new Cursors(this, this.debug.socket)
      this.debug.player = new Player(this, this.newId(), { clientId: 55555, socketId: 'some-socket-id' })
      this.playerGroup.add(this.debug.player)

      // this helps debugging
      this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
        console.log(pointer.worldX, pointer.worldY)
        console.log(this.map.getTileByCoordinates({ x: pointer.worldX, y: pointer.worldY }))
      })
    }

    this.events.addListener('createPlayer', (clientId: number, socketId: string) => {
      let player: Player = this.playerGroup.getFirstDead()
      if (player) {
        player.revive(clientId, socketId)
      } else {
        player = new Player(this, this.newId(), { clientId, socketId })
        this.playerGroup.add(player)
      }
    })

    this.events.addListener('U' /* short for updateDude */, (res: any) => {
      // @ts-ignore
      let players: Player[] = this.playerGroup.children.getArray().filter((player: Player) => {
        return player.clientId && player.clientId === res.clientId
      })
      if (players[0]) {
        let b = res.updates
        let updates = {
          left: b === 1 || b === 5 ? true : false,
          right: b === 2 || b === 6 ? true : false,
          up: b === 4 || b === 6 || b === 5 ? true : false,
          none: b === 8 ? true : false
        }
        players[0].setUpdates(updates)
      }
    })

    this.events.addListener('removePlayer', (clientId: number) => {
      // @ts-ignore
      this.playerGroup.children.iterate((player: Player) => {
        if (player.clientId === clientId) {
          player.kill()
        }
      })
    })

    this.physics.add.collider(this.playerGroup, this.boxGroup)
    this.physics.add.collider(this.mummyGroup, this.boxGroup)
    // @ts-ignore
    this.physics.add.overlap(this.mummyGroup, this.playerGroup, (mummy: Mummy, player: Player) => {
      if (mummy.dead) return
      if (mummy.body.touching.up && player.body.touching.down) {
        player.setVelocityY(-300)
        mummy.kill()
      } else {
        player.gotHit()
      }
    })
    // @ts-ignore
    this.physics.add.overlap(this.playerGroup, this.star, (player: Player, star: Star) => {
      if (player.dead) return
      player.kill()

      let nextLevel = this.level + 1 >= this.map.countTotalLevels() ? 0 : this.level + 1
      let socket = this.roomManager.ioNspGame.sockets[player.socketId] as any

      this.roomManager.changeRoom(socket, 'ArcadeScene', nextLevel)
    })
  }

  /** Sends the initial state to the client */
  getInitialState() {
    let objects: any[] = []

    SyncManager.prepareFromPhaserGroup(this.boxGroup, objects)
    SyncManager.prepareFromPhaserGroup(this.playerGroup, objects)
    SyncManager.prepareFromPhaserSprite(this.star, objects)

    return SyncManager.encode(objects)
  }

  update() {
    this.tick++
    if (this.tick > 1000000) this.tick = 0

    // @ts-ignore
    this.mummyGroup.children.iterate((mummy: Mummy) => {
      let coordinates = mummy.getLookAhead()
      let tile = this.map.getTileByCoordinates(coordinates)
      mummy.changeDirection(tile)
      mummy.update()
    })

    if (PHYSICS_DEBUG) {
      this.debug.cursors.update()
      let cursorsDown = this.debug.cursors.cursorsDown()
      let player: Player = this.debug.player
      player.setUpdates(cursorsDown)
      player.update()
      this.cameras.main.setScroll(
        player.body.position.x - this.cameras.main.width / 2,
        player.body.position.y - this.cameras.main.height * 0.8
      )
      return
    }

    const prepareObjectToSync = (obj: any) => {
      let cleanObjectToSync = SyncManager.cleanObjectToSync(obj)
      this.objectsToSync = SyncManager.mergeObjectToSync(cleanObjectToSync, this.objectsToSync)
    }

    if (this.star && this.star.sync) {
      let starObj = {
        skin: this.star.skin,
        tint: this.star.tint,
        id: this.star.id,
        x: this.star.body.position.x + this.star.body.width / 2,
        y: this.star.body.position.y + this.star.body.height / 2
      }
      prepareObjectToSync(starObj)
      this.star.sync = false
    }

    // @ts-ignore
    this.mummyGroup.children.iterate((child: Mummy) => {
      let object = {
        skin: child.skin,
        direction: child.direction,
        id: child.id,
        x: child.body.position.x + child.body.width / 2,
        y: child.body.position.y + child.body.height / 2
      }
      prepareObjectToSync(object)
    })

    // @ts-ignore
    this.boxGroup.children.iterate((child: Box) => {
      if (child.sync) {
        let object = {
          skin: child.skin,
          id: child.id,
          x: child.body.position.x + child.body.width / 2,
          y: child.body.position.y + child.body.height / 2
        }
        prepareObjectToSync(object)
      }
      child.sync = false
    })
    // @ts-ignore
    this.playerGroup.children.iterate((child: Player) => {
      child.update()
      // we only update the dude if one if the 4 properties below have changed
      let x = child.prevPosition.x.toFixed(0) !== child.body.position.x.toFixed(0)
      let y = child.prevPosition.y.toFixed(0) !== child.body.position.y.toFixed(0)
      let dead = child.prevDead !== child.dead
      let color = child.prevColor.toString() !== child.color.toString()
      if (x || y || dead || color) {
        let object = {
          animation: child.animation,
          dead: child.dead,
          clientId: child.clientId,
          skin: child.skin,
          tint: child.color,
          id: child.id,
          x: child.body.position.x + child.body.width / 2,
          y: child.body.position.y + child.body.height / 2
        }
        prepareObjectToSync(object)
      }
      child.postUpdate()
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
