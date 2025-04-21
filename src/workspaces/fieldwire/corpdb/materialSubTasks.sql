USE [corp]
GO

/****** Object:  Table [dbo].[materialSubTasks]    Script Date: 4/15/2025 6:46:00 AM ******/
SET ANSI_NULLS ON
GO

SET QUOTED_IDENTIFIER ON
GO

CREATE TABLE [dbo].[materialSubTasks](
	[materialSubTaskId] [nvarchar](40) NOT NULL,
	[materialId] [nvarchar](40) NOT NULL,
	[statusName] [nvarchar](100) NOT NULL,
	[taskNameFormat] [nvarchar](50) NULL,
	[laborHours] [decimal](18, 0) NOT NULL,
	[ordinal] [smallint] NOT NULL,
	[projectId] [nvarchar](40) NULL,
	[createat] [date] NOT NULL,
	[createby] [nvarchar](40) NOT NULL,
	[updateat] [date] NOT NULL,
	[updateby] [nvarchar](40) NOT NULL,
 CONSTRAINT [PK_materialsubtasks] PRIMARY KEY CLUSTERED 
(
	[materialSubTaskId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO

ALTER TABLE [dbo].[materialSubTasks] ADD  CONSTRAINT [DF_materialSubTasks_materialSubTaskId]  DEFAULT (newid()) FOR [materialSubTaskId]
GO

ALTER TABLE [dbo].[materialSubTasks] ADD  DEFAULT ((0.00)) FOR [laborHours]
GO

ALTER TABLE [dbo].[materialSubTasks] ADD  DEFAULT ((0)) FOR [ordinal]
GO

ALTER TABLE [dbo].[materialSubTasks] ADD  DEFAULT (getdate()) FOR [createat]
GO

ALTER TABLE [dbo].[materialSubTasks] ADD  DEFAULT ('system') FOR [createby]
GO

ALTER TABLE [dbo].[materialSubTasks] ADD  DEFAULT (getdate()) FOR [updateat]
GO

ALTER TABLE [dbo].[materialSubTasks] ADD  DEFAULT ('system') FOR [updateby]
GO

