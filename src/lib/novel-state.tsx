"use client"

import React, { createContext, useContext, useState, ReactNode } from 'react'

// 定义状态接口
export interface NovelState {
    currentNovelId: string
    location: string
    hp: number
    inventory: string[]
    // 可以根据需要扩展更多字段，比如当前章节、角色状态等
    currentChapter?: string
    activeCharacters?: string[]
}

// 初始状态
const defaultState: NovelState = {
    currentNovelId: "default-novel",
    location: "未定",
    hp: 100,
    inventory: []
}

// Context 定义
interface NovelStateContextType {
    state: NovelState
    updateState: (newState: Partial<NovelState>) => void
    addItem: (item: string) => void
    removeItem: (item: string) => void
    setLocation: (location: string) => void
}

const NovelStateContext = createContext<NovelStateContextType | undefined>(undefined)

// Provider 组件
export function NovelStateProvider({ children }: { children: ReactNode }) {
    const [state, setState] = useState<NovelState>(defaultState)

    const updateState = (newState: Partial<NovelState>) => {
        setState(prev => ({ ...prev, ...newState }))
    }

    const addItem = (item: string) => {
        setState(prev => ({
            ...prev,
            inventory: [...prev.inventory, item]
        }))
    }

    const removeItem = (item: string) => {
        setState(prev => ({
            ...prev,
            inventory: prev.inventory.filter(i => i !== item)
        }))
    }

    const setLocation = (location: string) => {
        setState(prev => ({ ...prev, location }))
    }

    return (
        <NovelStateContext.Provider value={{ state, updateState, addItem, removeItem, setLocation }}>
            {children}
        </NovelStateContext.Provider>
    )
}

// Hook
export function useNovelState() {
    const context = useContext(NovelStateContext)
    if (context === undefined) {
        throw new Error('useNovelState must be used within a NovelStateProvider')
    }
    return context
}
