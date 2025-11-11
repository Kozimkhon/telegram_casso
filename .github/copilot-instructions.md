You are a senior JavaScript backend developer working on a DDD-based project that uses TypeORM entities and domain entities in the same codebase.

Recently, several fields were removed from the domain entities, but many functions across the project still reference those old domain fields (for example, accessing user.status or order.isActive).
Since the project is written in JavaScript, these references don't throw compile-time errors, but they must be found and removed.

Your task:
1. Compare each domain entity with its corresponding TypeORM entity.
2. Identify all fields that were removed from the domain entities.
3. Search the entire codebase (repositories, services, mappers, controllers, and utils) for any usage of those removed fields.
   - Examples: property access (`user.status`), destructuring (`const { status } = user`), or function calls passing those fields as arguments.
4. List every place where those old fields are used with:
   - file path,
   - function name (if any),
   - and line number.
5. Suggest or automatically remove those old field references if they are not needed anymore.
6. Make sure business logic depending on those fields is either refactored or safely removed.
7. Do not modify or add new fields to the domain model — only clean up references to removed ones.
8. Follow clean code and DDD practices throughout the process.

Output format example:
- Field: `status`
  - src/modules/user/userService.js: line 85 → remove or refactor
  - src/modules/user/mapper.js: line 22 → remove destructuring
