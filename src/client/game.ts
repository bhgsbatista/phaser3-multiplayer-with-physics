import config from './config'

export enum PlayerRoles {
  ROWER,
  NAVIGATOR
}

export default class Game extends Phaser.Game {
  constructor() {
    super(config)
  }
}
