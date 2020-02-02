import Resize from '../components/resize'
import { PlayerRole } from '../../constants'

export default class MenuScene extends Phaser.Scene {
  socket: Socket
  constructor() {
    super({ key: 'MenuScene' })
  }

  init(props: { socket: Socket }) {
    const { socket } = props
    this.socket = socket
  }

  create() {
    const styles = {
      color: '#ffffff',
      align: 'center',
      fontSize: 52
    }

    let texts: any[] = []

    texts.push(this.add.text(0, 0, 'Choose Your Role:', styles).setOrigin(0.5, 0))

    texts.push(
      this.add
        .text(0, 0, 'Join as a Rower', styles)
        .setOrigin(0.5, 0)
        .setInteractive()
        .on('pointerdown', () => {
          this.scene.start('MainScene', { scene: 'MatterScene', playerRole: PlayerRole.ROWER, socket: this.socket })
        })
    )

    texts.push(
      this.add
        .text(0, 0, 'Join as a Navigator', styles)
        .setOrigin(0.5, 0)
        .setInteractive()
        .on('pointerdown', () => {
          this.scene.start('MainScene', { scene: 'MatterScene', playerRole: PlayerRole.NAVIGATOR, socket: this.socket })
        })
    )

    texts.push(
      this.add
        .text(0, 0, 'Join as a Spectator', styles)
        .setOrigin(0.5, 0)
        .setInteractive()
        .on('pointerdown', () => {
          this.scene.stop()
          this.scene.start('MainScene', { scene: 'MatterScene', playerRole: PlayerRole.SPECTATOR, socket: this.socket })
        })
    )

    const resize = () => {
      const { centerX, centerY } = this.cameras.main
      let posY = [20, centerY - 100, centerY, centerY + 100]
      texts.forEach((text, i) => {
        text.setPosition(centerX, posY[i])
      })
    }

    this.scale.on('resize', (gameSize: any, baseSize: any, displaySize: any, resolution: any) => {
      if (!this.scene.isActive()) return
      this.cameras.resize(gameSize.width, gameSize.height)
      resize()
    })
    resize()
    Resize(this.game)
  }
}
