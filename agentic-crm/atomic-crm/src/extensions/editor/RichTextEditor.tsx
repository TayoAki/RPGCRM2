import { TableKit } from "@tiptap/extension-table";
import { Markdown } from "@tiptap/markdown";
import {
  type Editor,
  EditorContent,
  useEditor,
  useEditorState,
} from "@tiptap/react";
import { StarterKit } from "@tiptap/starter-kit";
import {
  Bold,
  Heading2,
  Heading3,
  Italic,
  List,
  ListOrdered,
  type LucideIcon,
  Quote,
} from "lucide-react";
import { Toggle } from "@/components/ui/toggle";
import { cn } from "@/lib/utils";

import { MARKDOWN_STYLES } from "../../components/atomic-crm/misc/Markdown";

type Tool = {
  label: string;
  icon: LucideIcon;
  isActive: (editor: Editor) => boolean;
  run: (editor: Editor) => void;
};

const TOOLS: Tool[] = [
  {
    label: "Bold",
    icon: Bold,
    isActive: (editor) => editor.isActive("bold"),
    run: (editor) => editor.chain().focus().toggleBold().run(),
  },
  {
    label: "Italic",
    icon: Italic,
    isActive: (editor) => editor.isActive("italic"),
    run: (editor) => editor.chain().focus().toggleItalic().run(),
  },
  {
    label: "Heading",
    icon: Heading2,
    isActive: (editor) => editor.isActive("heading", { level: 2 }),
    run: (editor) => editor.chain().focus().toggleHeading({ level: 2 }).run(),
  },
  {
    label: "Subheading",
    icon: Heading3,
    isActive: (editor) => editor.isActive("heading", { level: 3 }),
    run: (editor) => editor.chain().focus().toggleHeading({ level: 3 }).run(),
  },
  {
    label: "Bulleted list",
    icon: List,
    isActive: (editor) => editor.isActive("bulletList"),
    run: (editor) => editor.chain().focus().toggleBulletList().run(),
  },
  {
    label: "Numbered list",
    icon: ListOrdered,
    isActive: (editor) => editor.isActive("orderedList"),
    run: (editor) => editor.chain().focus().toggleOrderedList().run(),
  },
  {
    label: "Quote",
    icon: Quote,
    isActive: (editor) => editor.isActive("blockquote"),
    run: (editor) => editor.chain().focus().toggleBlockquote().run(),
  },
];

type RichTextEditorProps = {
  value: string;
  onChange: (markdown: string) => void;
  label: string;
  className?: string;
};

/** Formatted text that is stored as Markdown. `value` is read once, when the editor opens. */
export const RichTextEditor = ({
  value,
  onChange,
  label,
  className,
}: RichTextEditorProps) => {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ link: { openOnClick: false } }),
      TableKit,
      // Matches how the CRM renders Markdown, where a single newline is a line break.
      Markdown.configure({ markedOptions: { breaks: true } }),
    ],
    content: value,
    contentType: "markdown",
    editorProps: {
      attributes: {
        role: "textbox",
        "aria-multiline": "true",
        "aria-label": label,
        class: cn(MARKDOWN_STYLES, "min-h-72 px-3 py-2 outline-none"),
      },
    },
    // Placeholders stay "[like this]" for the people and the assistant reading the raw text.
    onUpdate: ({ editor }) =>
      onChange(editor.getMarkdown().replace(/\\([[\]])/g, "$1")),
  });
  const active = useEditorState({
    editor,
    selector: ({ editor }) => TOOLS.map((tool) => tool.isActive(editor)),
  });

  return (
    <div
      className={cn(
        "rounded-md border border-input shadow-xs focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50",
        className,
      )}
    >
      <div
        role="toolbar"
        aria-label={`${label} formatting`}
        className="sticky top-0 z-10 flex flex-wrap gap-0.5 rounded-t-md border-b bg-background p-1"
      >
        {TOOLS.map((tool, index) => (
          <Toggle
            key={tool.label}
            size="sm"
            aria-label={tool.label}
            title={tool.label}
            pressed={active[index]}
            onPressedChange={() => tool.run(editor)}
          >
            <tool.icon />
          </Toggle>
        ))}
      </div>
      <EditorContent editor={editor} />
    </div>
  );
};
