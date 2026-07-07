"use client"
import { useEffect, useState } from 'react'

export function useLiveScan(initial:boolean=false){
  const [running, setRunning] = useState(initial)
  const [events, setEvents] = useState<Array<any>>([])

  useEffect(()=>{
    if (!running) return
    let i = 0
    const id = setInterval(()=>{
      i++
      setEvents(e=>[{id: Date.now(), type: i%3===0? 'ALERT':'MATCH', token: ['AI','MEGA','PIX'][i%3], when: new Date().toLocaleTimeString(), details: `Simulated event #${i}`}, ...e].slice(0,20))
    }, 900)
    return ()=> clearInterval(id)
  }, [running])

  return { running, events, start: ()=>setRunning(true), stop: ()=>setRunning(false), clear: ()=>setEvents([]) }
}
