import PreloadScene from './scenes/preloadScene'
import MenuScene from './scenes/menuScene'
import MainScene from './scenes/mainScene'

const DEFAULT_WIDTH = 1280
const DEFAULT_HEIGHT = 720

// the size of the world
export const world = {
  x: 0,
  y: 0,
  width: 2000,
  height: 2000
}

const config = {
  type: Phaser.WEBGL,
  backgroundColor: 0x2E86C1,
  scale: {
    parent: 'phaser-game',
    mode: Phaser.Scale.NONE,
    width: DEFAULT_WIDTH,
    height: DEFAULT_HEIGHT
  },
  scene: [PreloadScene, MenuScene, MainScene],
  physics: {
    default: 'matter',
    matter: {
      gravity: {
        y: 0.8
      },
      debug: false,
      debugBodyColor: 0xff00ff
    }
  }
}
export default config
