import os from 'os'

export function getIpAddress(): string {
  const interfaces = os.networkInterfaces();

  for (const iname in interfaces) {
    if (iname.toLowerCase().indexOf('docker') !== -1) {
      continue;
    }

    const iface = interfaces[iname];

    for (let i = 0; i < iface.length; i++) {
      const alias = iface[i];
      if (alias.family === 'IPv4' && alias.address !== '127.0.0.1' && !alias.internal)
        return alias.address;
    }
  }

  return '0.0.0.0';
}
