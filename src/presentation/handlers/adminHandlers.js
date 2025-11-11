/**
 * @fileoverview Admin Registration Handler
 * Handles admin registration process
 * @module presentation/handlers/adminHandlers
 */

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
      const phone = ctx.from?.phone_number||"";
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
        await ctx.editMessageText(
          `✅ *Registration Successful*\n\nYou have been registered as an admin.\nPlease restart the bot with /start`,
          { parse_mode: "Markdown" }
        );
      } else {
        await ctx.editMessageText(
          `❌ *Registration Failed*\n\n${result.message}`,
          { parse_mode: "Markdown" }
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
