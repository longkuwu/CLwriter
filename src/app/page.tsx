"use client"

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { getAllProjects, deleteProject, type ProjectData } from '@/lib/actions/projects'
import { Plus, BookOpen, Trash2, Castle, Flame } from 'lucide-react'
import { Button } from '@/components/ui/button'
import CreateProjectModal from '@/components/dashboard/CreateProjectModal'

export default function DashboardPage() {
  const [projects, setProjects] = useState<ProjectData[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [newProjectOpen, setNewProjectOpen] = useState(false)

  // 加载项目列表
  useEffect(() => {
    loadProjects()
  }, [])

  async function loadProjects() {
    setIsLoading(true)
    try {
      const list = await getAllProjects()
      setProjects(list)
    } catch (e) {
      console.error('加载项目失败:', e)
    } finally {
      setIsLoading(false)
    }
  }

  async function handleDeleteProject(e: React.MouseEvent, id: string) {
    e.preventDefault()
    e.stopPropagation()
    if (confirm('确定要删除这本书吗？删除后无法恢复。')) {
      await deleteProject(id)
      loadProjects()
    }
  }

  // 获取引擎图标
  const getEngineIcon = (engineType: string | null) => {
    if (engineType === 'viral') {
      return <Flame className="w-6 h-6 text-orange-400" />
    }
    return <Castle className="w-6 h-6 text-purple-400" />
  }

  return (
    <div className="min-h-screen bg-background text-foreground p-8">
      <div className="max-w-6xl mx-auto">
        <header className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">我的书架</h1>
            <p className="text-muted-foreground mt-1">管理您所有的创作项目</p>
          </div>

          <Button className="gap-2" onClick={() => setNewProjectOpen(true)}>
            <Plus className="w-4 h-4" />
            新建作品
          </Button>

          <CreateProjectModal
            isOpen={newProjectOpen}
            onClose={() => {
              setNewProjectOpen(false)
              loadProjects()
            }}
          />
        </header>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-48 rounded-lg bg-muted/50 animate-pulse" />
            ))}
          </div>
        ) : projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground border-2 border-dashed rounded-lg">
            <BookOpen className="w-12 h-12 mb-4 opacity-20" />
            <p className="text-lg font-medium">还没有创建任何书籍</p>
            <p className="text-sm">点击右上角&quot;新建作品&quot;开启创作之旅</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {projects.map(project => (
              <Link
                key={project.id}
                href={`/editor/${project.id}`}
                className="group relative flex flex-col h-48 rounded-lg border bg-card p-6 shadow-sm transition-all hover:shadow-md hover:border-primary/50"
              >
                <div className="flex-1">
                  <div className="flex items-start justify-between">
                    <div className={`p-2 rounded-md mb-4 ${project.engineType === 'viral' ? 'bg-orange-500/10' : 'bg-purple-500/10'}`}>
                      {getEngineIcon(project.engineType)}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity -mr-2 -mt-2"
                      onClick={(e) => handleDeleteProject(e, project.id)}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                  <h3 className="font-semibold text-lg line-clamp-2">{project.title}</h3>
                  <span className={`inline-block mt-2 px-2 py-0.5 text-[10px] rounded-full ${project.engineType === 'viral' ? 'bg-orange-500/20 text-orange-400' : 'bg-purple-500/20 text-purple-400'}`}>
                    {project.engineType === 'viral' ? '🔥 流量爆款' : '🏰 宏大叙事'}
                  </span>
                </div>
                <div className="mt-4 text-xs text-muted-foreground">
                  <span suppressHydrationWarning>最后编辑: {new Date(project.updatedAt).toLocaleDateString()}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
