import { Context, Schema, sleep, h } from "koishi";
import {} from "koishi-plugin-adapter-onebot";

export const name = "group-notice";

export interface Config {
  interval: number;
}

export const Config: Schema<Config> = Schema.object({
  interval: Schema.number()
    .role("slider")
    .min(0.5)
    .max(10)
    .step(0.5)
    .default(1)
    .description("发送多组公告的间隔，单位秒"),
});

export function apply(ctx: Context, { interval }: Config) {
  ctx = ctx.platform("onebot");
  ctx.i18n.define("zh-CN", require("./locales/zh_CN"));
  ctx
    .command("group-notice [...groupIds:string]", "", { authority: 3 })
    .alias("发公告")
    .action(async ({ session }, ...groupIds) => {
      if (groupIds.length == 0) {
        groupIds.push(session.guildId);
      }
      await session.send(session.text(".what-to-add"));
      const reply = await session.prompt();
      const h_reply = h.parse(reply);
      if (reply.includes("取消发送公告")) {
        return session.text(".cancelled");
      }
      let contents = [];
      let alert_flag = false;
      for (let e of h_reply) {
        if (e.type === "text") {
          contents.push(e);
        } else {
          alert_flag = true;
        }
      }
      let content = contents.join("\n");
      if (alert_flag) {
        await session.send(session.text(".type-warn"));
      }
      if (content.length > 600 || content.length < 1) {
        await session.send(session.text(".length-warn", [content.length]));
        return;
      }
      for (let i = 0; i < groupIds.length; i++) {
        if (i) {
          await sleep(interval * 1000);
        }
        await session.onebot.sendGroupNotice(groupIds[i], contents.join("\n"));
      }
    });
}
