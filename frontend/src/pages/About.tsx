import { ABOUT } from '@/config/constants'
import MarkdownIt from 'markdown-it'

const md = new MarkdownIt()

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-4xl animate-in fade-in duration-500">
      <article className="rounded-[2rem] border border-border bg-card px-6 py-8 md:px-12 md:py-12">
          <div
            className="prose prose-sm max-w-none dark:prose-invert md:prose-base prose-headings:font-editorial prose-headings:text-foreground prose-h1:text-4xl prose-p:leading-8 prose-p:text-foreground/80 prose-strong:text-foreground prose-ul:text-foreground/80 prose-ol:text-foreground/80"
            dangerouslySetInnerHTML={{ __html: md.render(ABOUT) }}
          />
      </article>
    </div>
  )
}
