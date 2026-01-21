
import React, { createContext, useContext, useEffect, useState } from 'react';
import { Campaign, Channel, Ticket, TicketStatus, Status, User, Priority, RoadmapItem, Project, ProjectUpdate, ChannelLink, ChannelNote, TimelineTag, ChannelPlan, ContextDoc, DocFolder } from './types';

// Safe ID Generator
export const generateId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    try {
      return crypto.randomUUID();
    } catch (e) {
      // Fallback
    }
  }
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
};

export const MOCK_USERS: User[] = [
  { id: 'u1', name: 'Founder', initials: 'FD', color: 'bg-indigo-500' },
  { id: 'u2', name: 'Growth Lead', initials: 'GL', color: 'bg-emerald-500' },
  { id: 'u3', name: 'Engineer', initials: 'EN', color: 'bg-purple-500' },
  { id: 'u4', name: 'Designer', initials: 'DS', color: 'bg-pink-500' },
];

interface StoreState {
  campaign: Campaign | null;
  users: User[];
  currentUser: User;
  setCampaign: (campaign: Campaign) => void;
  updateCampaign: (updates: Partial<Campaign>) => void;
  
  addChannel: (channel: Channel) => void;
  updateChannel: (channelId: string, updates: Partial<Channel>) => void;
  deleteChannel: (channelId: string) => void;
  updateChannelPlan: (channelId: string, plan: ChannelPlan) => void;
  
  addChannelPrinciple: (channelId: string, text: string) => void;
  deleteChannelPrinciple: (channelId: string, principleId: string) => void;
  addChannelLink: (channelId: string, link: ChannelLink) => void;
  removeChannelLink: (channelId: string, linkId: string) => void;
  addChannelNote: (channelId: string, note: ChannelNote) => void;
  deleteChannelNote: (channelId: string, noteId: string) => void;
  addChannelMember: (channelId: string, userId: string) => void;
  removeChannelMember: (channelId: string, userId: string) => void;
  
  addProject: (project: Project) => void;
  updateProject: (projectId: string, updates: Partial<Project>) => void;
  deleteProject: (projectId: string) => void;
  addProjectUpdate: (projectId: string, update: ProjectUpdate) => void;
  
  addProjectTicket: (projectId: string, ticket: Ticket) => void;
  updateProjectTicket: (projectId: string, ticketId: string, updates: Partial<Ticket>) => void;
  deleteProjectTicket: (projectId: string, ticketId: string) => void;

  addTicket: (channelId: string, ticket: Ticket) => void;
  updateTicket: (channelId: string, ticketId: string, updates: Partial<Ticket>) => void;
  deleteTicket: (channelId: string, ticketId: string) => void;
  
  linkDocToTicket: (docId: string, ticketId: string, channelId?: string, projectId?: string) => void;
  
  addRoadmapItem: (item: RoadmapItem) => void;
  updateRoadmapItem: (itemId: string, updates: Partial<RoadmapItem>) => void;
  deleteRoadmapItem: (itemId: string) => void;
  moveRoadmapItem: (itemId: string, newChannelId: string, newWeekIndex: number) => void;
  
  addTimelineTag: (tag: TimelineTag) => void;
  deleteTimelineTag: (tagId: string) => void;

  addDocFolder: (name: string, icon?: string) => void;
  updateDocFolder: (folderId: string, updates: Partial<DocFolder>) => void;
  renameDocFolder: (folderId: string, name: string) => void;
  deleteDocFolder: (folderId: string) => void;
  
  addDoc: (doc: ContextDoc) => void;
  updateDoc: (docId: string, updates: Partial<ContextDoc>) => void;
  deleteDoc: (docId: string) => void;
  moveDoc: (docId: string, folderId: string | undefined) => void;
  
  addCampaignTag: (tag: string) => void;

  importAIPlan: (channelsData: any[]) => void;
  switchUser: (userId: string) => void;
  reset: () => void;
}

const StoreContext = createContext<StoreState | undefined>(undefined);

export const StoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [users] = useState<User[]>(MOCK_USERS);
  const [currentUser, setCurrentUser] = useState<User>(MOCK_USERS[0]);

  const [campaign, setCampaignState] = useState<Campaign | null>(() => {
    const saved = localStorage.getItem('gtm-os-campaign');
    if (!saved) return null;
    
    const data = JSON.parse(saved);
    
    // MIGRATION Logic
    if (data.channels) {
        data.channels = data.channels.map((c: any) => ({
            ...c,
            principles: c.principles || [],
            tags: c.tags || [],
            links: c.links || [],
            notes: c.notes || [],
            memberIds: c.memberIds || [],
            plan: c.plan || undefined,
            tickets: c.tickets || [] 
        }));
    }

    if (!data.projects) {
        data.projects = [];
    } else {
        data.projects = data.projects.map((p: any) => ({
            ...p,
            tickets: p.tickets || []
        }));
    }

    if (!data.timelineTags) data.timelineTags = [];
    if (!data.docs) data.docs = [];
    
    // Folder Migration
    if (!data.docFolders) {
        data.docFolders = [
            { id: 'f_strategy', name: 'Strategy', icon: '♟️', createdAt: new Date().toISOString() },
            { id: 'f_personas', name: 'Personas', icon: '👥', createdAt: new Date().toISOString() },
            { id: 'f_brand', name: 'Brand', icon: '🎨', createdAt: new Date().toISOString() },
            { id: 'f_process', name: 'Process', icon: '⚙️', createdAt: new Date().toISOString() },
        ];
        // Migrate existing docs to folders based on type
        if (data.docs) {
            data.docs = data.docs.map((d: any) => {
                let folderId = undefined;
                if (d.type === 'STRATEGY') folderId = 'f_strategy';
                else if (d.type === 'PERSONA') folderId = 'f_personas';
                else if (d.type === 'BRAND') folderId = 'f_brand';
                else if (d.type === 'PROCESS') folderId = 'f_process';
                return { ...d, folderId };
            });
        }
    } else {
        // Ensure icons exist if migrating from old version
        data.docFolders = data.docFolders.map((f: any) => ({
            ...f,
            icon: f.icon || '📁'
        }));
    }
    
    if (!data.availableTags) {
        data.availableTags = ['Draft', 'Q4', 'Urgent', 'Review'];
    }

    return data;
  });

  useEffect(() => {
    if (campaign) {
      localStorage.setItem('gtm-os-campaign', JSON.stringify(campaign));
    } else {
      localStorage.removeItem('gtm-os-campaign');
    }
  }, [campaign]);

  const setCampaign = (c: Campaign) => setCampaignState(c);

  const updateCampaign = (updates: Partial<Campaign>) => {
    if (!campaign) return;
    setCampaignState(prev => prev ? ({ ...prev, ...updates }) : null);
  };

  const addChannel = (channel: Channel) => {
    if (!campaign) return;
    setCampaignState(prev => prev ? ({
      ...prev,
      channels: [...prev.channels, { 
          ...channel, 
          tickets: [],
          principles: channel.principles || [], 
          tags: channel.tags || [], 
          links: [], 
          notes: [],
          memberIds: []
      }]
    }) : null);
  };

  const updateChannel = (channelId: string, updates: Partial<Channel>) => {
    if (!campaign) return;
    setCampaignState(prev => prev ? ({
      ...prev,
      channels: prev.channels.map(c => c.id === channelId ? { ...c, ...updates } : c)
    }) : null);
  };

  const updateChannelPlan = (channelId: string, plan: ChannelPlan) => {
    if (!campaign) return;
    setCampaignState(prev => prev ? ({
      ...prev,
      channels: prev.channels.map(c => c.id === channelId ? { ...c, plan } : c)
    }) : null);
  };

  const deleteChannel = (channelId: string) => {
    if (!campaign) return;
    const newChannels = campaign.channels.filter(c => c.id !== channelId);
    const newRoadmapItems = (campaign.roadmapItems || []).filter(i => i.channelId !== channelId);
    
    setCampaignState(prev => prev ? ({
      ...prev,
      channels: newChannels,
      roadmapItems: newRoadmapItems
    }) : null);
  };

  const addChannelPrinciple = (channelId: string, text: string) => {
    if (!campaign) return;
    const principle = { id: generateId(), text };
    setCampaignState(prev => prev ? ({
      ...prev,
      channels: prev.channels.map(c => 
        c.id === channelId ? { ...c, principles: [...(c.principles || []), principle] } : c
      )
    }) : null);
  };

  const deleteChannelPrinciple = (channelId: string, principleId: string) => {
    if (!campaign) return;
    setCampaignState(prev => prev ? ({
      ...prev,
      channels: prev.channels.map(c => 
        c.id === channelId ? { ...c, principles: (c.principles || []).filter(p => p.id !== principleId) } : c
      )
    }) : null);
  };

  const addChannelLink = (channelId: string, link: ChannelLink) => {
    if (!campaign) return;
    setCampaignState(prev => prev ? ({
      ...prev,
      channels: prev.channels.map(c => 
        c.id === channelId ? { ...c, links: [...(c.links || []), link] } : c
      )
    }) : null);
  };

  const removeChannelLink = (channelId: string, linkId: string) => {
    if (!campaign) return;
    setCampaignState(prev => prev ? ({
      ...prev,
      channels: prev.channels.map(c => 
        c.id === channelId ? { ...c, links: (c.links || []).filter(l => l.id !== linkId) } : c
      )
    }) : null);
  };

  const addChannelNote = (channelId: string, note: ChannelNote) => {
    if (!campaign) return;
    setCampaignState(prev => prev ? ({
      ...prev,
      channels: prev.channels.map(c => 
        c.id === channelId ? { ...c, notes: [note, ...(c.notes || [])] } : c
      )
    }) : null);
  };

  const deleteChannelNote = (channelId: string, noteId: string) => {
    if (!campaign) return;
    setCampaignState(prev => prev ? ({
      ...prev,
      channels: prev.channels.map(c => 
        c.id === channelId ? { ...c, notes: (c.notes || []).filter(n => n.id !== noteId) } : c
      )
    }) : null);
  };

  const addChannelMember = (channelId: string, userId: string) => {
      if (!campaign) return;
      setCampaignState(prev => prev ? ({
          ...prev,
          channels: prev.channels.map(c => {
              if (c.id !== channelId) return c;
              const currentMembers = c.memberIds || [];
              if (currentMembers.includes(userId)) return c;
              return { ...c, memberIds: [...currentMembers, userId] };
          })
      }) : null);
  };

  const removeChannelMember = (channelId: string, userId: string) => {
      if (!campaign) return;
      setCampaignState(prev => prev ? ({
          ...prev,
          channels: prev.channels.map(c => {
              if (c.id !== channelId) return c;
              return { ...c, memberIds: (c.memberIds || []).filter(id => id !== userId) };
          })
      }) : null);
  };

  const addProject = (project: Project) => {
    if (!campaign) return;
    setCampaignState(prev => prev ? ({
      ...prev,
      projects: [...(prev.projects || []), { ...project, tickets: [] }]
    }) : null);
  };

  const updateProject = (projectId: string, updates: Partial<Project>) => {
    if (!campaign) return;
    setCampaignState(prev => prev ? ({
      ...prev,
      projects: (prev.projects || []).map(p => p.id === projectId ? { ...p, ...updates } : p)
    }) : null);
  };

  const deleteProject = (projectId: string) => {
    if (!campaign) return;
    setCampaignState(prev => prev ? ({
      ...prev,
      projects: (prev.projects || []).filter(p => p.id !== projectId),
      roadmapItems: (prev.roadmapItems || []).filter(i => i.projectId !== projectId)
    }) : null);
  };

  const addProjectUpdate = (projectId: string, update: ProjectUpdate) => {
    if (!campaign) return;
    setCampaignState(prev => prev ? ({
      ...prev,
      projects: (prev.projects || []).map(p => p.id === projectId ? {
        ...p,
        updates: [update, ...(p.updates || [])]
      } : p)
    }) : null);
  };

  const addProjectTicket = (projectId: string, ticket: Ticket) => {
    if (!campaign) return;
    
    let newRoadmapItems = [...(campaign.roadmapItems || [])];
    const finalTicket = { ...ticket, projectId };

    if (!finalTicket.roadmapItemId) {
        const newItemId = generateId();
        finalTicket.roadmapItemId = newItemId;
        
        const newItem: RoadmapItem = {
            id: newItemId,
            channelId: undefined, 
            weekIndex: 0, 
            durationWeeks: 1,
            title: ticket.title,
            description: ticket.description,
            type: 'CONTENT',
            ticketId: finalTicket.id,
            projectId: projectId,
            status: ticket.status === TicketStatus.Done ? Status.Completed : Status.Active,
            ownerIds: ticket.assigneeId ? [ticket.assigneeId] : [],
            priority: ticket.priority,
            label: 'Task'
        };
        newRoadmapItems.push(newItem);
    }

    setCampaignState(prev => prev ? ({
        ...prev,
        roadmapItems: newRoadmapItems,
        projects: prev.projects.map(p => p.id === projectId ? {
            ...p,
            tickets: [...(p.tickets || []), finalTicket]
        } : p)
    }) : null);
  };

  const updateProjectTicket = (projectId: string, ticketId: string, updates: Partial<Ticket>) => {
      if (!campaign) return;
      
      let newRoadmapItems = [...(campaign.roadmapItems || [])];
      const rItemIndex = newRoadmapItems.findIndex(i => i.ticketId === ticketId);
      
      if (rItemIndex !== -1) {
          const rItem = newRoadmapItems[rItemIndex];
          let updatedRItem = { ...rItem };
          let changed = false;

          if (updates.status) {
              if (updates.status === TicketStatus.Done) {
                  updatedRItem.status = Status.Completed;
                  changed = true;
              } else if (rItem.status === Status.Completed) {
                  updatedRItem.status = Status.Active;
                  changed = true;
              }
          }
          if (updates.title) updatedRItem.title = updates.title;
          if (updates.assigneeId) updatedRItem.ownerIds = [updates.assigneeId];
          if (changed) newRoadmapItems[rItemIndex] = updatedRItem;
      }

      setCampaignState(prev => prev ? ({
          ...prev,
          roadmapItems: newRoadmapItems,
          projects: prev.projects.map(p => p.id === projectId ? {
              ...p,
              tickets: p.tickets.map(t => t.id === ticketId ? { ...t, ...updates } : t)
          } : p)
      }) : null);
  };

  const deleteProjectTicket = (projectId: string, ticketId: string) => {
      if (!campaign) return;
      setCampaignState(prev => prev ? ({
          ...prev,
          roadmapItems: prev.roadmapItems.filter(i => i.ticketId !== ticketId),
          projects: prev.projects.map(p => p.id === projectId ? {
              ...p,
              tickets: p.tickets.filter(t => t.id !== ticketId)
          } : p)
      }) : null);
  };

  const addTicket = (channelId: string, ticket: Ticket) => {
    if (!campaign) return;
    const shortId = `T-${Math.floor(Math.random() * 1000)}`;
    const finalTicket = { ...ticket, shortId, channelId };

    let newRoadmapItems = [...(campaign.roadmapItems || [])];
    
    if (!finalTicket.roadmapItemId) {
        const newItemId = generateId();
        finalTicket.roadmapItemId = newItemId;
        
        const newItem: RoadmapItem = {
            id: newItemId,
            channelId: channelId,
            weekIndex: 0, 
            durationWeeks: 1,
            title: ticket.title,
            description: ticket.description,
            type: 'CONTENT',
            ticketId: finalTicket.id,
            projectId: ticket.projectId,
            status: ticket.status === TicketStatus.Done ? Status.Completed : Status.Active,
            ownerIds: ticket.assigneeId ? [ticket.assigneeId] : [],
            priority: ticket.priority,
            label: 'Task'
        };
        newRoadmapItems.push(newItem);
    }

    setCampaignState(prev => prev ? ({
      ...prev,
      roadmapItems: newRoadmapItems,
      channels: prev.channels.map(c => 
        c.id === channelId ? { ...c, tickets: [...c.tickets, finalTicket] } : c
      )
    }) : null);
  };

  const updateTicket = (channelId: string, ticketId: string, updates: Partial<Ticket>) => {
    if (!campaign) return;
    
    let newRoadmapItems = [...(campaign.roadmapItems || [])];
    const rItemIndex = newRoadmapItems.findIndex(i => i.ticketId === ticketId);
    
    if (rItemIndex !== -1) {
         const rItem = newRoadmapItems[rItemIndex];
         let updatedRItem = { ...rItem };
         let changed = false;

         if (updates.status) {
             if (updates.status === TicketStatus.Done) {
                 updatedRItem.status = Status.Completed;
                 changed = true;
             } else if (rItem.status === Status.Completed) {
                 updatedRItem.status = Status.Active;
                 changed = true;
             }
         }
         if (updates.title) updatedRItem.title = updates.title;
         if (updates.assigneeId) updatedRItem.ownerIds = [updates.assigneeId];
         if (changed) newRoadmapItems[rItemIndex] = updatedRItem;
    }

    setCampaignState(prev => prev ? ({
      ...prev,
      roadmapItems: newRoadmapItems,
      channels: prev.channels.map(c => 
        c.id === channelId ? {
          ...c,
          tickets: c.tickets.map(t => t.id === ticketId ? { ...t, ...updates } : t)
        } : c
      )
    }) : null);
  };

  const deleteTicket = (channelId: string, ticketId: string) => {
    if (!campaign) return;
    const newRoadmapItems = (campaign.roadmapItems || []).filter(i => i.ticketId !== ticketId);

    setCampaignState(prev => prev ? ({
      ...prev,
      roadmapItems: newRoadmapItems,
      channels: prev.channels.map(c => 
        c.id === channelId ? {
          ...c,
          tickets: c.tickets.filter(t => t.id !== ticketId)
        } : c
      )
    }) : null);
  };
  
  const linkDocToTicket = (docId: string, ticketId: string, channelId?: string, projectId?: string) => {
      if (channelId) {
          const channel = campaign?.channels.find(c => c.id === channelId);
          const ticket = channel?.tickets.find(t => t.id === ticketId);
          if (ticket) {
              const currentDocs = ticket.linkedDocIds || [];
              if (!currentDocs.includes(docId)) {
                  updateTicket(channelId, ticketId, { linkedDocIds: [...currentDocs, docId] });
              }
          }
      } else if (projectId) {
          const project = campaign?.projects.find(p => p.id === projectId);
          const ticket = project?.tickets.find(t => t.id === ticketId);
           if (ticket) {
              const currentDocs = ticket.linkedDocIds || [];
              if (!currentDocs.includes(docId)) {
                  updateProjectTicket(projectId, ticketId, { linkedDocIds: [...currentDocs, docId] });
              }
          }
      }
  };

  const addRoadmapItem = (item: RoadmapItem) => {
    if (!campaign) return;
    let newItem = { ...item };
    
    // Direct Channel Link (Create Ticket)
    if (newItem.channelId && !newItem.ticketId) {
         const ticketId = generateId();
         const ticket: Ticket = {
             id: ticketId,
             shortId: `T-${Math.floor(Math.random() * 10000)}`,
             title: newItem.title,
             description: newItem.description,
             status: TicketStatus.Todo,
             channelId: newItem.channelId,
             projectId: newItem.projectId,
             roadmapItemId: newItem.id,
             assigneeId: newItem.ownerIds?.[0],
             priority: newItem.priority || 'Medium',
             createdAt: new Date().toISOString()
         };
         
         newItem.ticketId = ticketId;
         
         setCampaignState(prev => {
             if (!prev) return null;
             const newChannels = prev.channels.map(c => 
                 c.id === newItem.channelId ? { ...c, tickets: [...c.tickets, ticket] } : c
             );
             return {
                 ...prev,
                 channels: newChannels,
                 roadmapItems: [...(prev.roadmapItems || []), newItem]
             };
         });
         return;
    } 
    // Direct Project Link (Create Project Ticket)
    else if (newItem.projectId && !newItem.channelId && !newItem.ticketId) {
        const ticketId = generateId();
        const ticket: Ticket = {
            id: ticketId,
            shortId: `T-${Math.floor(Math.random() * 10000)}`,
            title: newItem.title,
            description: newItem.description,
            status: TicketStatus.Todo,
            projectId: newItem.projectId,
            roadmapItemId: newItem.id,
            assigneeId: newItem.ownerIds?.[0],
            priority: newItem.priority || 'Medium',
            createdAt: new Date().toISOString()
        };
        newItem.ticketId = ticketId;
        
        setCampaignState(prev => prev ? ({
            ...prev,
            roadmapItems: [...(prev.roadmapItems || []), newItem],
            projects: prev.projects.map(p => p.id === newItem.projectId ? {
                ...p,
                tickets: [...(p.tickets || []), ticket]
            } : p)
        }) : null);
        return;
    }

    setCampaignState(prev => prev ? ({
      ...prev,
      roadmapItems: [...(prev.roadmapItems || []), newItem]
    }) : null);
  };

  const updateRoadmapItem = (itemId: string, updates: Partial<RoadmapItem>) => {
    if (!campaign) return;
    setCampaignState(prev => prev ? ({
      ...prev,
      roadmapItems: (prev.roadmapItems || []).map(i => i.id === itemId ? { ...i, ...updates } : i)
    }) : null);
  };

  const moveRoadmapItem = (itemId: string, newChannelId: string, newWeekIndex: number) => {
    updateRoadmapItem(itemId, { channelId: newChannelId, weekIndex: newWeekIndex });
  };

  const deleteRoadmapItem = (itemId: string) => {
    if (!campaign) return;
    const item = campaign.roadmapItems.find(i => i.id === itemId);
    let newChannels = [...campaign.channels];
    let newProjects = [...campaign.projects];

    if (item && item.ticketId) {
         if (item.channelId) {
             newChannels = newChannels.map(c => ({
                 ...c,
                 tickets: c.tickets.filter(t => t.id !== item.ticketId)
             }));
         } else if (item.projectId) {
             newProjects = newProjects.map(p => ({
                 ...p,
                 tickets: p.tickets.filter(t => t.id !== item.ticketId)
             }));
         }
    }

    setCampaignState(prev => prev ? ({
      ...prev,
      channels: newChannels,
      projects: newProjects,
      roadmapItems: (prev.roadmapItems || []).filter(i => i.id !== itemId)
    }) : null);
  };

  const addTimelineTag = (tag: TimelineTag) => {
    if (!campaign) return;
    setCampaignState(prev => prev ? ({
        ...prev,
        timelineTags: [...(prev.timelineTags || []), tag]
    }) : null);
  };

  const deleteTimelineTag = (tagId: string) => {
    if (!campaign) return;
    setCampaignState(prev => prev ? ({
        ...prev,
        timelineTags: (prev.timelineTags || []).filter(t => t.id !== tagId)
    }) : null);
  };

  // --- Folder Actions ---

  const addDocFolder = (name: string, icon: string = '📁') => {
      if (!campaign) return;
      const folder: DocFolder = {
          id: generateId(),
          name,
          icon,
          createdAt: new Date().toISOString()
      };
      setCampaignState(prev => prev ? ({
          ...prev,
          docFolders: [...prev.docFolders, folder]
      }) : null);
  };

  const updateDocFolder = (folderId: string, updates: Partial<DocFolder>) => {
      if (!campaign) return;
      setCampaignState(prev => prev ? ({
          ...prev,
          docFolders: prev.docFolders.map(f => f.id === folderId ? { ...f, ...updates } : f)
      }) : null);
  };

  const deleteDocFolder = (folderId: string) => {
      if (!campaign) return;
      setCampaignState(prev => prev ? ({
          ...prev,
          docFolders: prev.docFolders.filter(f => f.id !== folderId),
          docs: prev.docs.map(d => d.folderId === folderId ? { ...d, folderId: undefined } : d) // Move to Unsorted
      }) : null);
  };

  // --- Doc Actions ---

  const addDoc = (doc: ContextDoc) => {
    if (!campaign) return;
    setCampaignState(prev => prev ? ({
        ...prev,
        docs: [...(prev.docs || []), doc]
    }) : null);
  };

  const updateDoc = (docId: string, updates: Partial<ContextDoc>) => {
    if (!campaign) return;
    setCampaignState(prev => prev ? ({
        ...prev,
        docs: (prev.docs || []).map(d => d.id === docId ? { ...d, ...updates } : d)
    }) : null);
  };

  const deleteDoc = (docId: string) => {
    if (!campaign) return;
    setCampaignState(prev => prev ? ({
        ...prev,
        docs: (prev.docs || []).filter(d => d.id !== docId)
    }) : null);
  };

  const moveDoc = (docId: string, folderId: string | undefined) => {
      updateDoc(docId, { folderId });
  };
  
  const addCampaignTag = (tag: string) => {
      if (!campaign || (campaign.availableTags || []).includes(tag)) return;
      setCampaignState(prev => prev ? ({
          ...prev,
          availableTags: [...(prev.availableTags || []), tag]
      }) : null);
  };

  const importAIPlan = (channelsData: any[]) => {
    if (!campaign) return;
    const newChannels: Channel[] = channelsData.map((c: any) => ({
      id: generateId(),
      name: c.name,
      campaignId: campaign.id,
      tickets: c.tickets.map((t: any) => ({
        id: generateId(),
        shortId: `T-${Math.floor(Math.random() * 1000)}`,
        title: t.title,
        description: t.description,
        status: TicketStatus.Todo,
        channelId: '', // Set in loop below
        priority: 'Medium',
        createdAt: new Date().toISOString()
      })),
      principles: [],
      tags: [],
      links: [],
      notes: [],
      memberIds: []
    }));
    
    newChannels.forEach(c => {
      c.tickets.forEach(t => t.channelId = c.id);
    });

    setCampaignState(prev => prev ? ({
      ...prev,
      channels: [...prev.channels, ...newChannels]
    }) : null);
  };

  const switchUser = (userId: string) => {
    const user = users.find(u => u.id === userId);
    if (user) setCurrentUser(user);
  };

  const reset = () => {
    setCampaignState(null);
  };

  return (
    <StoreContext.Provider value={{
      campaign,
      users,
      currentUser,
      setCampaign,
      updateCampaign,
      addChannel,
      updateChannel,
      deleteChannel,
      updateChannelPlan,
      addChannelPrinciple,
      deleteChannelPrinciple,
      addChannelLink,
      removeChannelLink,
      addChannelNote,
      deleteChannelNote,
      addChannelMember,
      removeChannelMember,
      addProject,
      updateProject,
      deleteProject,
      addProjectUpdate,
      addProjectTicket,
      updateProjectTicket,
      deleteProjectTicket,
      addTicket,
      updateTicket,
      deleteTicket,
      linkDocToTicket,
      addRoadmapItem,
      updateRoadmapItem,
      deleteRoadmapItem,
      moveRoadmapItem,
      addTimelineTag,
      deleteTimelineTag,
      addDocFolder,
      updateDocFolder,
      renameDocFolder: (id, name) => updateDocFolder(id, { name }), // Compatibility
      deleteDocFolder,
      addDoc,
      updateDoc,
      deleteDoc,
      moveDoc,
      addCampaignTag,
      importAIPlan,
      switchUser,
      reset
    }}>
      {children}
    </StoreContext.Provider>
  );
};

export const useStore = () => {
  const context = useContext(StoreContext);
  if (!context) throw new Error("useStore must be used within StoreProvider");
  return context;
};
