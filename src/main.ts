import { MessageBuilder, Webhook } from "minimal-discord-webhook-node";

//debug, info, log, warn, error.
const getLogLevel = (checkWith: string): number => {
  switch(checkWith) {
    case "error":
      return 5;
    case "warn":
      return 4;
    case "log":
      return 3;
    case "info":
      return 2;
    case "debug":
      return 1;
    default:
      return 0;
  }
}

export default {
  async tail(events: TraceItem[], env: Env, ctx: ExecutionContext) {

    // quick and dirty little log filter system for testing
    const logActivity = (str: string) => {
      // @ts-ignore: wrangler gives booleans to strings. shut up
      if (env.LOG_ACTIVITY === "true") {
        console.log(str);
      }
    };

    // configs
    const maxFields: number = Number(env.MAX_FIELDS);
    const settingsLogLevel: number = getLogLevel(env.LOG_LEVEL);
    // webhook
    const discordWebhook = new Webhook({url: env.WEBHOOK, throwErrors: false, retryOnLimit: false});

    // process events
    for (const data of events) {
      // get us logs that matter
      const erroredLogs = data.logs.filter((itm, _idx, _array) => { return getLogLevel(itm.level) >= settingsLogLevel; });
      // skip if we have no logs that match the right level
      if (erroredLogs.length == 0) {
        continue;
      }

      // Otherwise, relay the log files.
      const msg = new MessageBuilder();
      msg.setAuthor(`Cloudflare ${data.scriptName} Logger`);
      msg.setTitle(`${data.scriptName} Alert`);
      msg.addField("Version", `${data.scriptVersion?.id ?? 0}`);
      msg.addField("CPU Time", `${data.cpuTime}ms`);
      msg.addField("Has Exceptions?", (data.exceptions.length > 0).toString());
      msg.setFooter(`Build version: ${data.scriptVersion?.id || 0} | Timestamp: ${data.eventTimestamp}`);
      msg.setDescription(`${data.scriptName} ran into an ${env.LOG_LEVEL} or higher event!`);
      // this is red
      msg.setColor(14291731);
      // allow us to put a cap on fields
      let numFields = 0;
      erroredLogs.forEach((itm, idx) => {
        if (numFields > maxFields)
          return;

        // add the field
        msg.addField(`Log #${idx}`, `${itm.level} - ${JSON.stringify(itm.message)}`, false);
        ++numFields;
      });
      logActivity(`Processed msg ${JSON.stringify(msg.getJSON())}`);
      // avoid all slowdowns, keep processing
      ctx.waitUntil(discordWebhook.send(msg));
    }
  }
}