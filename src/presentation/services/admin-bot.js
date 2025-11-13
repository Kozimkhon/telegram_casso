import { Markup } from "telegraf";

export async function handleAdminNotRegistered(ctx) {
  const text =
    `❌ <b>Access Denied</b>\n\n` +
    `You are not registered as an admin.\n` +
    `To get access, you need to register as an admin.\n\n` +
    `Contact the system administrator or use the registration option below:`;
  const keyboard = Markup.inlineKeyboard([
    [Markup.button.callback("📝 Register as Admin", "register_admin")],
    [Markup.button.callback("ℹ️ Contact Support", "contact_support")],
  ]);
  try {
    if (ctx.callbackQuery) {
      await ctx.editMessageText(text, {
        parse_mode: "HTML",
        ...keyboard,
      });
    } else {
      await ctx.reply(text, {
        parse_mode: "HTML",
        ...keyboard,
      });
    }
  } catch (error) {
    // Handle case where message content is identical
    if (error.message && error.message.includes("message is not modified")) {
      // Answer the callback query to remove the loading state
      if (ctx.callbackQuery) {
        await ctx.answerCbQuery("ℹ️ Already showing registration options");
      }
    } else {
      // Re-throw other errors
      throw error;
    }
  }
}
