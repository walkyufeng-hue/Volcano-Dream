import { Toaster as Sonner } from "sonner"
import { useGlobalState } from "@/store"

type ToasterProps = React.ComponentProps<typeof Sonner>

const Toaster = ({ ...props }: ToasterProps) => {
  const { isDark } = useGlobalState()

  return (
    <Sonner
      theme={isDark ? "dark" : "light"}
      position="top-center"
      offset="80px"
      duration={4000}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-card group-[.toaster]:text-card-foreground group-[.toaster]:shadow-xl",
          description: "group-[.toast]:text-muted-foreground",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground group-[.toast]:hover:bg-primary/90",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
          error: "group-[.toaster]:text-destructive",
          success: "group-[.toaster]:bg-primary/10",
          warning: "",
          info: "",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
