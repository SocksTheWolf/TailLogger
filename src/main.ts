import has from "just-has";
import { MessageBuilder, Webhook } from "minimal-discord-webhook-node";
import { getColorLevel, getLogLevel } from "./levels";

function processLogs(msg: MessageBuilder, log: TraceLog[]|TraceException[], maxFields: number=20) {
  let numFields: number = 0;
  log.forEach((itm, idx) => {
    if (numFields > maxFields)
      return;

    // add the field
    if (has(itm, "level"))
      msg.addField(`Log #${idx}`, `${(itm as TraceLog).level} - ${JSON.stringify(itm.message)}`, false);
    else
      msg.addField(`Exception #${idx}`, `${JSON.stringify(itm.message)}`, false);
    ++numFields;
  });
}

export default {
  async tail(events: TraceItem[], env: Env, ctx: ExecutionContext) {
    // quick and dirty little log filter system for testing
    const logActivity = (str: string) => {
      // @ts-expect-error: wrangler gives booleans to strings. shut up
      if (env.LOG_INTERNAL_ACTIVITY === "true") {
        console.log(str);
      }
    };

    // configs
    const maxFields: number = Number(env.MAX_FIELDS);
    // webhook
    const discordWebhook = new Webhook({url: env.WEBHOOK, throwErrors: false, retryOnLimit: false});

    // process events
    for (const data of events) {
      const projectLogLevel: string = (data.scriptName ?
        await env.LOG_SETTINGS.get(data.scriptName?.toLowerCase(), "text") : undefined)
        ?? env.DEFAULT_LOG_LEVEL;

      const logLevelValue: number = getLogLevel(projectLogLevel);
      let highestLogLevel: string = "";
      let highestLogNum: number|undefined;
      // get us logs that matter
      const erroredLogs = data.logs.filter((itm, _idx, _array) => {
        // capture what the highest log level we have in this event is
        const curLogLevel = getLogLevel(itm.level);
        if (highestLogNum === undefined || curLogLevel > highestLogNum) {
          // cache it
          highestLogNum = curLogLevel;
          highestLogLevel = itm.level;
        }
        // and filter out everything else
        return curLogLevel >= logLevelValue;
      });

      // our exception checker
      const hasException: boolean = (data.exceptions.length > 0);

      // skip if we have no logs that match the right level
      // and we don't have exceptions
      if (!hasException) {
        if (erroredLogs.length == 0) {
          continue;
        }
        // if we only want to see exceptions, filter out if we don't have an exception
        // (exception logs write as errors)
        if (projectLogLevel === "exception")
          continue;
      } else {
        highestLogLevel = "exception";
      }

      // Otherwise, relay the log files.
      const msg = new MessageBuilder();
      msg.setTitle(`"${data.scriptName}" Application Alert`);
      msg.addField("Exception?", hasException.toString(), true);
      msg.addField("Time", `CPU: ${data.cpuTime}ms | Wall: ${data.wallTime}ms`, true);
      msg.setFooter(`Build version: ${data.scriptVersion?.id || 0} | Timestamp: ${data.eventTimestamp}`);
      msg.setDescription(`${data.scriptName} triggered a ${projectLogLevel} or higher event!`);
      // add logs
      processLogs(msg, erroredLogs, (hasException) ? maxFields : maxFields*2);
      // add exceptions
      processLogs(msg, data.exceptions, maxFields);
      // set the embed color based on highest log level
      msg.setColor(getColorLevel(highestLogLevel));
      logActivity(`Processed msg ${JSON.stringify(msg.getJSON())}`);
      // avoid all slowdowns, keep processing
      ctx.waitUntil(discordWebhook.send(msg));
    }
  }
}