/**
 * @fileoverview Admin Registration Handler
 * Handles admin registration process
 * @module presentation/handlers/adminHandlers
 */

import { Markup } from "telegraf";
import { createChildLogger } from "../../shared/logger.js";

const logger = createChildLogger({ component: "AdminHandlers" });

/**
 * Creates admin handlers with injected dependencies
 * @param {Object} dependencies - Injected use cases
 * @returns {Object} Admin handler functions
 */
export function createAdminHandlers(dependencies) {
  const { addAdminUseCase } = dependencies;

  /**
   * Handles admin registration process
   * @param {Object} ctx - Telegraf context
   */
  async function handleAdminRegistration(ctx) {
    try {
      const userId = ctx.from?.id?.toString();
      const username = ctx.from?.username;
      const firstName = ctx.from?.first_name;
      const lastName = ctx.from?.last_name;
      const phone = ctx.from?.phone_number || "";
      if (!userId) {
        await ctx.reply("❌ Unable to get user information");
        return;
      }

      // Attempt to add admin
      const result = await addAdminUseCase.execute({
        userId,
        username,
        firstName,
        lastName,
        phone,
      });

      if (result.success) {
        const text =
          `✅ <b>Registration Successful!</b>\n\n` +
          `Welcome, <b>${firstName}</b>!\n` +
          `You are now registered as an admin.\n\n` +
          `🎯 <b>Next Step:</b>\n` +
          `Add your phone session to activate the userbot functionality.\n\n` +
          `📱 Click "Add Session" to connect your phone number and start managing channels!`;

        const keyboard = Markup.inlineKeyboard([
          [Markup.button.callback("📱 Add Session", "add_session")],
          [Markup.button.callback("🏠 Main Menu", "main_menu")],
        ]);

        await ctx.editMessageText(text, {
          parse_mode: "HTML",
          ...keyboard,
        });

        logger.info("Admin auto-registration successful", {
          userId: userId,
          username: username,
          firstName: firstName,
        });
      } else {
        await ctx.editMessageText(
          `❌ <b>Registration Failed</b>\n\nThere was an error during registration. Please try again or contact support.`,
          {
            parse_mode: "HTML",
            reply_markup: {
              inline_keyboard: [
                [
                  { text: "🔄 Try Again", callback_data: "register_admin" },
                  {
                    text: "📞 Contact Support",
                    callback_data: "contact_support",
                  },
                ],
              ],
            },
          }
        );
      }
    } catch (error) {
      logger.error("Error during admin registration", error);
      await ctx.reply("❌ Registration error. Please contact support.");
    }
  }

  return {
    handleAdminRegistration,
  };
}
