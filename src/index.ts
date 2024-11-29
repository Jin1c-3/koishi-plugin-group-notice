import { Context, Schema, sleep, h } from "koishi";
import {} from "koishi-plugin-adapter-onebot";
import path from "path";
import fs from "fs";

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

interface NoticeContent {
  text: string;
  imagePath?: string;
}

async function processImage(
  ctx: Context,
  imageUrl: string,
  filename: string
): Promise<string> {
  const root = path.join(ctx.baseDir, "temp");
  if (!fs.existsSync(root)) {
    fs.mkdirSync(root, { recursive: true });
  }
  const buffer = Buffer.from(
    await ctx.http.get(imageUrl, { responseType: "arraybuffer" })
  );
  const imagePath = path.join(root, filename);
  await fs.promises.writeFile(imagePath, buffer);
  return imagePath;
}

async function sendGroupNotice(
  session: any,
  groupId: string,
  content: NoticeContent
): Promise<void> {
  if (content.imagePath) {
    try {
      await session.onebot.sendGroupNotice(
        groupId,
        content.text,
        content.imagePath
      );
    } catch (e) {
      await session.send(session.text(".img-send-fail"));
      await session.onebot.sendGroupNotice(groupId, content.text);
    }
  } else {
    await session.onebot.sendGroupNotice(groupId, content.text);
  }
}

export function apply(ctx: Context, { interval }: Config) {
  ctx = ctx.platform("onebot");
  ctx.i18n.define("zh-CN", require("./locales/zh_CN"));

  ctx
    .command("group-notice [...groupIds:string]", "", { authority: 3 })
    .alias("发公告")
    .action(async ({ session }, ...groupIds) => {
      if (groupIds.length === 0) {
        groupIds.push(session.guildId);
      }

      await session.send(session.text(".what-to-add"));
      const reply = await session.prompt();

      if (reply.includes("取消发送公告")) {
        return session.text(".cancelled");
      }

      const contents: h.Fragment[] = [];
      let hasUnsupportedContent = false;
      let imagePath: string;

      for (const element of h.parse(reply)) {
        if (element.type === "text") {
          contents.push(element);
        } else if (element.type === "image" || element.type === "img") {
          imagePath = await processImage(
            ctx,
            element.attrs.src,
            element.attrs.filename
          );
        } else {
          hasUnsupportedContent = true;
        }
      }

      const noticeText = contents.join("\n");

      if (hasUnsupportedContent) {
        await session.send(session.text(".type-warn"));
      }
      if (noticeText.length > 600 || noticeText.length < 1) {
        await session.send(session.text(".length-warn", [noticeText.length]));
        return;
      }

      try {
        for (let i = 0; i < groupIds.length; i++) {
          if (i > 0) await sleep(interval * 1000);
          await sendGroupNotice(session, groupIds[i], {
            text: noticeText,
            imagePath,
          });
        }

        return session.text(".success");
      } finally {
        if (imagePath) {
          await fs.promises.unlink(imagePath);
        }
      }
    });
}
