USE [corp]
GO

/****** Object:  Table [dbo].[tenants]    Script Date: 4/2/2025 11:58:12 PM ******/
SET ANSI_NULLS ON
GO

SET QUOTED_IDENTIFIER ON
GO

CREATE TABLE [dbo].[tenants](
	[id] [nvarchar](50) NOT NULL,
	[name] [nvarchar](255) NOT NULL,
	[tierlevel] [smallint] NULL,
 CONSTRAINT [PK_tenants] PRIMARY KEY CLUSTERED 
(
	[id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO

ALTER TABLE [dbo].[tenants] ADD  CONSTRAINT [DF_tenants_plan]  DEFAULT ((1)) FOR [tierlevel]
GO

