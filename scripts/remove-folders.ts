import { prisma } from "../src/lib/prisma";

// One-off migration: Folder as a distinct organizational concept is being
// removed since Board already supports nesting (board-link shapes). Existing
// folders are deleted; their direct children move to the top level.
async function main() {
  const folders = await prisma.node.findMany({ where: { type: "FOLDER" } });
  console.log(`Found ${folders.length} folder(s).`);

  for (const folder of folders) {
    const { count } = await prisma.node.updateMany({
      where: { parentId: folder.id },
      data: { parentId: null },
    });
    console.log(`  "${folder.title}" (${folder.id}): reparented ${count} child(ren) to top level.`);
  }

  const { count: deleted } = await prisma.node.deleteMany({
    where: { type: "FOLDER" },
  });
  console.log(`Deleted ${deleted} folder(s).`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
