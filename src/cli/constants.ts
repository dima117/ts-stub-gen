import { bin, name, version } from "../../package.json";

/** Имя утилиты — ключ bin в package.json. */
export const BIN_NAME = Object.keys(bin)[0] ?? name;
export const VERSION = version;
/** Конфиг по соглашению: <утилита>.config.json в текущей папке. */
export const DEFAULT_CONFIG_FILENAME = `${BIN_NAME}.config.json`;
