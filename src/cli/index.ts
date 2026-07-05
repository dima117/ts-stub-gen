import { resolve } from "path";
import { cac } from "cac";
import { ConfigError, loadConfig } from "./config";
import { BIN_NAME, DEFAULT_CONFIG_FILENAME, VERSION } from "./constants";
import { runStubGen } from "./run";

const HELP_HINT = `справка: ${BIN_NAME} --help`;

export function main(argv: string[] = process.argv.slice(2)): number {
  const cli = cac(BIN_NAME);
  let exitCode = 0;

  cli
    .command(
      "[config]",
      `генерация стаб-хелперов по конфигу (по умолчанию ./${DEFAULT_CONFIG_FILENAME}); ` +
        "формат конфига — в документации пакета"
    )
    .action((configPath?: string) => {
      exitCode = generate(configPath ?? DEFAULT_CONFIG_FILENAME);
    });
  cli.help();
  cli.version(VERSION);

  try {
    cli.parse([process.execPath, BIN_NAME, ...argv]);
  } catch (e) {
    const error = e as Error;
    if (error instanceof ConfigError || error.name === "CACError") {
      console.error(`ошибка: ${error.message}`);
      console.error(HELP_HINT);
      return 1;
    }
    throw e;
  }
  return exitCode;
}

function generate(configPath: string): number {
  const config = loadConfig(resolve(process.cwd(), configPath));
  const result = runStubGen(config);
  for (const w of result.warnings) {
    console.warn(`[${w.level}] ${w.code} (${w.path}): ${w.message}`);
  }
  if (result.hasErrors) {
    console.error(
      "генерация прервана: есть предупреждения уровня error, файл не записан"
    );
    return 1;
  }
  console.log(
    `${result.outputFile}: сгенерировано, типов в схеме — ${result.typesCount}`
  );
  return 0;
}
